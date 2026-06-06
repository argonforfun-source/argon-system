import os

def patch_enterprise():
    file_path = 'clinica-repo/argon-enterprise.js'
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    new_code = """
// ── 3. Clinical Summary Versioning (Wave 2) ──
window.ArgonClinicalParser = {
  getClinicalList: function(patientData, fieldName) {
    if (!patientData || !patientData[fieldName]) return [];
    const data = patientData[fieldName];
    
    // 1. New Format (Array of Objects)
    if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') {
      return data;
    }
    
    const encodeStableId = (item, index) => {
      // Create a stable ID using base64 without relying on math.random for legacy items
      try {
        return 'legacy_' + btoa(encodeURIComponent(item)).substring(0, 15) + '_' + index;
      } catch (e) {
        return 'legacy_' + index;
      }
    };

    // 2. Legacy Format (Array of Strings)
    if (Array.isArray(data)) {
      return data.map((item, index) => ({
        entryId: encodeStableId(item, index),
        value: item,
        status: 'active',
        sourceType: 'legacy_import',
        isLegacy: true,
        schemaVersion: 2
      }));
    }
    
    // 3. Legacy Format (String)
    if (typeof data === 'string') {
      return data.split(/[,،]/).map(item => item.trim()).filter(Boolean).map((item, index) => ({
        entryId: encodeStableId(item, index),
        value: item,
        status: 'active',
        sourceType: 'legacy_import',
        isLegacy: true,
        schemaVersion: 2
      }));
    }
    
    return [];
  },

  toLegacyText: function(entries) {
    if (!Array.isArray(entries)) return '';
    return entries.filter(e => e.status === 'active').map(e => e.value).join('، ');
  }
};
"""
    if 'window.ArgonClinicalParser =' not in content:
        content += new_code
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print("ArgonClinicalParser added.")
    else:
        print("ArgonClinicalParser already present.")

if __name__ == '__main__':
    patch_enterprise()
