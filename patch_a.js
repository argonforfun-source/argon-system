const fs = require('fs');
let code = fs.readFileSync('./clinica-repo/argon-enterprise.js', 'utf8');

const userFindMatch = `  async function findMatch(clinicId, incoming, db) {
    if (!ARGON_FLAGS.enableSmartMatch) {
      return { result: MatchResult.NEW, confidence: 0, reason: "SmartMatch disabled" };
    }

    const inNID   = ArgonNID.cleanNID(incoming.nationalId || '');
    const inPhone = (incoming.phone || '').replace(/\\D/g,'');
    const inName  = incoming.name || '';

    // ══════════════════════════════════════════════════════════
    // 🔒 ABSOLUTE RULE #1 — رقم وطني موجود = EXACT فوري
    // ══════════════════════════════════════════════════════════
    if (ArgonNID.isValidNID(inNID)) {
      try {
        const nidSnap = await db
          .ref(\`clinics/\${clinicId}/patients\`)
          .orderByChild('info/nationalId')
          .equalTo(inNID)
          .once('value');

        let matchedByNID = null;
        nidSnap.forEach(child => {
          if (!matchedByNID) {
            matchedByNID = { id: child.key, ...child.val().info };
          }
        });

        if (matchedByNID) {
          return {
            result:      MatchResult.EXACT,
            confidence:  1.0,
            matchedId:   matchedByNID.id,
            matchedName: matchedByNID.name,
            reason:      '🔒 National ID exact match — ملف موجود مسجل بهذا الرقم الوطني',
            nidMatch:    true
          };
        }
      } catch (err) {
        console.error('[ARGON:Match] NID query error:', err);
      }
    }

    // ══════════════════════════════════════════════════════════
    // 🔒 ABSOLUTE RULE #2 — لا رقم وطني = لا ملف جديد
    // ══════════════════════════════════════════════════════════
    if (!ArgonNID.isValidNID(inNID)) {
      return {
        result:      'NEEDS_NID',
        confidence:  0,
        reason:      '🚫 الرقم الوطني غير موجود — يجب إدخاله قبل المتابعة',
        needsNID:    true
      };
    }

    // ══════════════════════════════════════════════════════════
    // البحث بالهاتف
    // ══════════════════════════════════════════════════════════
    let candidates = [];
    try {
      const snap = await db
        .ref(\`clinics/\${clinicId}/patients\`)
        .orderByChild('info/phone')
        .equalTo(incoming.phone)
        .once('value');
      snap.forEach(child => {
        candidates.push({ id: child.key, ...child.val().info });
      });
    } catch (err) {
      console.error('[ARGON:Match] Phone query error:', err);
      return { result: MatchResult.NEW, confidence: 0, reason: 'DB error' };
    }

    if (!candidates.length) {
      return { result: MatchResult.NEW, confidence: 0, reason: 'No phone match' };
    }

    let best = null, bestScore = 0;
    for (const c of candidates) {
      const score = nameSimilarity(inName, c.name);
      if (score > bestScore) { bestScore = score; best = c; }
    }

    if (bestScore >= 0.85) {
      return {
        result:      MatchResult.STRONG,
        confidence:  bestScore,
        matchedId:   best.id,
        matchedName: best.name,
        reason:      \`Phone + name similarity \${(bestScore*100).toFixed(1)}%\`
      };
    }
    if (bestScore >= 0.5) {
      return {
        result:      MatchResult.POSSIBLE,
        confidence:  bestScore,
        matchedId:   best.id,
        matchedName: best.name,
        reason:      \`Phone match, name similarity \${(bestScore*100).toFixed(1)}% — needs confirmation\`
      };
    }

    return {
      result:      MatchResult.POSSIBLE,
      confidence:  0.3,
      matchedId:   candidates[0].id,
      matchedName: candidates[0].name,
      reason:      'Same phone, different name — possible family member'
    };
  }
`;

const startIdx = code.indexOf('async function findMatch(');
const endStr = 'return { findMatch, normalizeArabic, normalizePhone, nameSimilarity, MatchResult };';
const endIdx = code.indexOf(endStr, startIdx);

if (startIdx !== -1 && endIdx !== -1) {
  code = code.substring(0, startIdx) + userFindMatch + '  ' + endStr + code.substring(endIdx + endStr.length);
  fs.writeFileSync('./clinica-repo/argon-enterprise.js', code);
  console.log('PATCH A APPLIED');
} else {
  console.log('FAILED TO FIND BOUNDARIES');
}
