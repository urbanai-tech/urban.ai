import re

file_path = 'docs/dump-ai_urban-202603131344.sql'

with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
    sql_text = f.read()

# Extract CREATE TABLE blocks
create_tables = re.findall(r'(CREATE TABLE `[^`]+` \([\s\S]*?\)\s*[^;]*;)', sql_text)

with open('docs/banco-antigo-schemas.md', 'w', encoding='utf-8') as out:
    out.write('# DDL do Banco Antigo\n\n')
    for table_ddl in create_tables:
        out.write(f'```sql\n{table_ddl.strip()}\n```\n\n')

print("Schemas extraídas para docs/banco-antigo-schemas.md")
