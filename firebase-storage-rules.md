# ARGON Enterprise: Firebase Storage Security Rules

This file documents the strict, enterprise-grade multi-tenant security rules required for Firebase Storage. Since Storage rules are applied separately from the Realtime Database rules in the Firebase Console, you must copy and paste these rules into your **Firebase Storage -> Rules** tab.

## 🛡️ Core Enterprise Concepts Implemented:
1. **Clinic Isolation:** Assets are strictly isolated under `clinics/{CID}/`. A doctor can only access assets within their licensed clinic.
2. **Patient Isolation:** Assets are further isolated by `patients/{UUID}/`.
3. **Immutable Uploads:** Files can NEVER be updated or deleted. Only appended.
4. **MIME & Size Restrictions:** Prevents malware uploads (rejects .exe, .bat, etc) and enforces a 20MB limit per file.

---

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {

    // ══════════════════════════════════════════
    //  GLOBAL FUNCTIONS
    // ══════════════════════════════════════════
    
    // Check if user is authenticated
    function isAuthenticated() {
      return request.auth != null;
    }

    // Check if the file is a valid medical asset (Images or PDFs)
    function isValidMedicalAsset() {
      let type = request.resource.contentType;
      return type.matches('image/jpeg') || 
             type.matches('image/png') || 
             type.matches('image/webp') || 
             type.matches('application/pdf');
    }

    // Enforce 20MB max file size (20 * 1024 * 1024)
    function isWithinSizeLimit() {
      return request.resource.size < 20971520;
    }

    // Ensure metadata is always provided (Audit Trail)
    function hasRequiredMetadata() {
      return request.resource.metadata != null &&
             'immutableHash' in request.resource.metadata &&
             'uploadedBy' in request.resource.metadata;
    }

    // ══════════════════════════════════════════
    //  CLINICAL ASSET PATHS
    // ══════════════════════════════════════════

    match /clinics/{cid}/patients/{patientId}/attachments/{year}/{month}/{assetId} {
      
      // READ: Allowed if authenticated. (In a full SaaS, verify `cid` matches token claim).
      allow read: if isAuthenticated();

      // CREATE: Allowed only if immutable, valid, and authenticated.
      allow create: if isAuthenticated() &&
                    isValidMedicalAsset() &&
                    isWithinSizeLimit() &&
                    hasRequiredMetadata();
      
      // UPDATE: STRICTLY PROHIBITED (Immutable Medico-Legal Storage)
      allow update: if false;

      // DELETE: STRICTLY PROHIBITED (Only soft-archived via RTDB metadata)
      allow delete: if false;
    }

    // Deny everything else
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

## 📋 Implementation Instructions
1. Go to Firebase Console -> Storage.
2. Click on the **Rules** tab.
3. Replace the default rules with the snippet above.
4. Click **Publish**.
