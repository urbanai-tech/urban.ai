import re
from collections import defaultdict

file_path = 'docs/dump-ai_urban-202603131344.sql'
tables = []
inserts = defaultdict(int)

with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
    for line in f:
        if line.startswith('CREATE TABLE'):
            # Looking for `table_name`
            match = re.search(r'`([^`]+)`', line)
            if match:
                tables.append(match.group(1))
        elif line.startswith('INSERT INTO'):
            match = re.search(r'`([^`]+)`', line)
            if match:
                inserts[match.group(1)] += 1

with open('docs/banco-antigo-analise.md', 'w', encoding='utf-8') as out:
    out.write('# Análise do Banco de Dados Antigo\n\n')
    out.write('## Tabelas Encontradas\n')
    for t in tables:
        out.write(f'- `{t}`\n')
    
    out.write('\n## Contagem de Registros (INSERTs)\n')
    if not inserts:
        out.write('Nenhum INSERT encontrado no dump.\n')
    for t, count in sorted(inserts.items(), key=lambda x: x[1], reverse=True):
        out.write(f'- `{t}`: {count} registros\n')

print("Análise concluída e salva em docs/banco-antigo-analise.md")
