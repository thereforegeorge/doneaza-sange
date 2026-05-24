// Funcții utilitare folosite în mai multe rute:
//   - compatibilitatea grupelor sanguine (cine poate dona pentru cine)
//   - calculul zilelor rămase din perioada de așteptare de 56 zile

// Matricea de compatibilitate: pentru fiecare grupă a primitorului,
// listăm grupele donatorilor care pot dona pentru el.
// (Sursa: regulamentele medicale standard pentru transfuzii.)
const compatibility = {
  'O-':  ['O-'],
  'O+':  ['O-', 'O+'],
  'A-':  ['O-', 'A-'],
  'A+':  ['O-', 'O+', 'A-', 'A+'],
  'B-':  ['O-', 'B-'],
  'B+':  ['O-', 'O+', 'B-', 'B+'],
  'AB-': ['O-', 'A-', 'B-', 'AB-'],
  'AB+': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+']
};

// Verifică dacă un donator cu grupa "donorType" poate dona pentru
// un pacient cu grupa "patientType".
function canDonate(donorType, patientType) {
  const allowed = compatibility[patientType];
  if (!allowed) return false;
  return allowed.indexOf(donorType) !== -1;
}

// Câte zile au trecut între două date ISO 'YYYY-MM-DD'.
// Returnează un întreg (pozitiv dacă lastDate e în trecut).
function daysSince(lastDate) {
  if (!lastDate) return Infinity;
  const last = new Date(lastDate);
  const now = new Date();
  const diffMs = now.getTime() - last.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

// Câte zile mai sunt până când utilizatorul poate dona din nou.
// Regula: 56 zile între donații de sânge integral.
// Returnează 0 dacă e deja eligibil.
function daysUntilEligible(lastDonation) {
  const passed = daysSince(lastDonation);
  if (passed >= 56) return 0;
  return 56 - passed;
}

module.exports = { canDonate, daysSince, daysUntilEligible, compatibility };
