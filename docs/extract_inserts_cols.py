import re

dump_path = 'docs/dump-ai_urban-202603131344.sql'
out_path = 'docs/inserts-only-cols.sql'

table_cols = {}
current_table = None

with open(dump_path, 'r', encoding='utf-8', errors='ignore') as f_in, \
     open(out_path, 'w', encoding='utf-8') as f_out:
    
    f_out.write('SET FOREIGN_KEY_CHECKS=0;\n')
    
    for line in f_in:
        line_s = line.strip()
        
        # Capture CREATE TABLE to get column order
        create_match = re.match(r'^CREATE TABLE `([^`]+)`', line_s)
        if create_match:
            current_table = create_match.group(1)
            table_cols[current_table] = []
            continue
            
        if current_table and line_s.startswith('`'):
            # Column definition
            col_match = re.match(r'^`([^`]+)`', line_s)
            if col_match:
                table_cols[current_table].append(col_match.group(1))
            continue
            
        if current_table and line_s.startswith(')'):
            current_table = None
            continue
            
        if line.startswith('INSERT INTO'):
            # INSERT INTO `table_name` VALUES or INSERT INTO `table_name` (`col`) VALUES
            insert_match = re.match(r'^INSERT INTO `([^`]+)` VALUES (.*)', line)
            if insert_match:
                t_name = insert_match.group(1)
                values_part = insert_match.group(2)
                if t_name in table_cols and len(table_cols[t_name]) > 0:
                    cols_str = ', '.join([f'`{c}`' for c in table_cols[t_name]])
                    new_line = f'INSERT INTO `{t_name}` ({cols_str}) VALUES {values_part}\n'
                    f_out.write(new_line)
                else:
                    f_out.write(line)
            else:
                f_out.write(line)
            
    f_out.write('SET FOREIGN_KEY_CHECKS=1;\n')

print(f"Extraído com sucesso para {out_path}")
