import json
import re

def update_rules():
    with open('clinica-repo/firebase-rules.json', 'r', encoding='utf-8') as f:
        content = f.read()

    # We want to replace the "patients" block.
    # Current block:
    # "patients": {
    #   ".read": true,
    #   ".write": true,
    #   "$patientId": {
    #     ".validate": "newData.hasChildren(['name', 'phone'])"
    #   }
    # },

    target = """"patients": {
          ".read": true,
          ".write": true,
          "$patientId": {
            ".validate": "newData.hasChildren(['name', 'phone'])"
          }
        }"""
        
    new_patients = """"patients": {
          ".read": true,
          "$patientId": {
            ".write": "!data.exists()",
            ".validate": "newData.hasChildren(['info']) || newData.hasChildren(['name'])",
            "visits": {
              "$visitId": {
                ".write": "newData.exists()"
              }
            },
            "$other": {
              ".write": true
            }
          }
        }"""

    # If the exact target matches, replace it
    if target in content:
        content = content.replace(target, new_patients)
    else:
        # regex replacement in case of spacing issues
        pattern = re.compile(r'"patients"\s*:\s*\{\s*"\.read"\s*:\s*true\s*,\s*"\.write"\s*:\s*true\s*,\s*"\$patientId"\s*:\s*\{\s*"\.validate"\s*:\s*"newData\.hasChildren\(\[\'name\',\s*\'phone\'\]\)"\s*\}\s*\}')
        content = pattern.sub(new_patients, content)
        
    with open('clinica-repo/firebase-rules.json', 'w', encoding='utf-8') as f:
        f.write(content)

update_rules()
