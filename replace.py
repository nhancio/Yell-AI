import os
import re

for root, dirs, files in os.walk('frontend'):
    if 'node_modules' in root or '.next' in root or '.git' in root or 'public' in root:
        continue
    for file in files:
        if file.endswith(('.ts', '.tsx', '.md', '.json', '.html', '.css', '.env', '.env.example', '.js', '.prisma')):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            
            # replacements
            content = content.replace('MyClaw', 'Yell AI')
            content = content.replace('myclaw', 'yellai')
            content = content.replace('MYCLAW', 'YELLAI')
            
            with open(path, 'w', encoding='utf-8') as f:
                f.write(content)

print("Replacement complete.")
