#!/usr/bin/env node
'use strict';

const path = require('node:path');
const ts = require('typescript');

const projectRoot = path.resolve(__dirname, '..');
const tsconfigPath = path.join(projectRoot, 'tsconfig.json');

function decoratorsOf(node) {
  return ts.canHaveDecorators(node) ? ts.getDecorators(node) || [] : [];
}

function isBodyDecorator(decorator) {
  const expression = decorator.expression;
  return ts.isCallExpression(expression) &&
    ts.isIdentifier(expression.expression) &&
    expression.expression.text === 'Body';
}

function resolveRuntimeClass(typeNode, checker) {
  if (!typeNode) return null;
  const type = checker.getTypeAtLocation(typeNode);
  let symbol = type.aliasSymbol || type.symbol;
  if (symbol && (symbol.flags & ts.SymbolFlags.Alias)) {
    symbol = checker.getAliasedSymbol(symbol);
  }
  const declaration = symbol?.declarations?.find((candidate) => ts.isClassDeclaration(candidate));
  return declaration && ts.isClassDeclaration(declaration)
    ? declaration.name?.text || '<anonymous class>'
    : null;
}

function auditBodyRuntimeDtos() {
  const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
  if (configFile.error) {
    throw new Error(ts.flattenDiagnosticMessageText(configFile.error.messageText, '\n'));
  }
  const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, projectRoot);
  const program = ts.createProgram(parsed.fileNames, parsed.options);
  const checker = program.getTypeChecker();
  const findings = [];
  let total = 0;
  let valid = 0;
  let controllerCount = 0;

  for (const sourceFile of program.getSourceFiles()) {
    if (sourceFile.isDeclarationFile || !sourceFile.fileName.endsWith('.controller.ts')) continue;
    controllerCount += 1;

    const visit = (node) => {
      if (ts.isParameter(node)) {
        const bodyDecorator = decoratorsOf(node).find(isBodyDecorator);
        if (bodyDecorator) {
          total += 1;
          const runtimeClass = resolveRuntimeClass(node.type, checker);
          if (runtimeClass) {
            valid += 1;
          } else {
            const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
            findings.push({
              file: path.relative(projectRoot, sourceFile.fileName).replace(/\\/g, '/'),
              line: position.line + 1,
              parameter: ts.isIdentifier(node.name) ? node.name.text : node.name.getText(sourceFile),
              type: node.type?.getText(sourceFile) || '<implicit any>',
            });
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }

  return { controllerCount, total, valid, findings };
}

function main() {
  const result = auditBodyRuntimeDtos();
  const invalid = result.findings.length;
  const summary = `${result.valid}/${result.total} @Body parameters use runtime DTO classes across ${result.controllerCount} controllers`;

  if (process.argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify({ ...result, invalid }, null, 2)}\n`);
  } else if (invalid === 0) {
    console.log(`[body-dto-audit] PASS: ${summary}.`);
  } else {
    console.error(`[body-dto-audit] FAIL: ${summary}; ${invalid} invalid parameter(s):`);
    for (const finding of result.findings) {
      console.error(`- ${finding.file}:${finding.line} @Body ${finding.parameter}: ${finding.type}`);
    }
    console.error('Replace inline/any/interface/array metatypes with a class DTO. Raw arrays must use a class marker plus a validating ParseArrayPipe.');
  }

  if (invalid > 0) process.exitCode = 1;
}

if (require.main === module) main();

module.exports = { auditBodyRuntimeDtos, isBodyDecorator, resolveRuntimeClass };
