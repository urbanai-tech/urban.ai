import re

dump_path = 'docs/dump-ai_urban-202603131344.sql'
out_path = 'docs/inserts-only.sql'

with open(dump_path, 'r', encoding='utf-8', errors='ignore') as f_in, \
     open(out_path, 'w', encoding='utf-8') as f_out:
    
    f_out.write('SET FOREIGN_KEY_CHECKS=0;\n')
    
    for line in f_in:
        if line.startswith('INSERT INTO'):
            f_out.write(line)
            
    f_out.write('SET FOREIGN_KEY_CHECKS=1;\n')

print(f"Extraído com sucesso para {out_path}")
