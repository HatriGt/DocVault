import { createDocument } from './documents';
import { makeSamplePdf } from './samplePdf';

const plusYears = (y: number, m = 0) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + y, d.getMonth() + m);
  return d.toISOString().slice(0, 10);
};

/** Seeds realistic, clearly-labelled sample documents (all encrypted like real ones). */
export async function seedSampleVault(holder: string) {
  const samples = [
    { name: 'Passport', tags: ['travel', 'india', 'renewal'], category: 'identity', type: 'Passport', expiry: plusYears(5, 7), fields: { holder, number: 'Z4821937', country: 'India', issuer: 'Republic of India' }, fav: true },
    { name: 'Emirates ID', tags: ['uae', 'id'], category: 'identity', type: 'National ID', expiry: plusYears(1, 9), fields: { holder, number: '784-1991-4827391-2', country: 'United Arab Emirates', issuer: 'ICP' }, fav: true },
    { name: 'Driving Licence', tags: ['india', 'id'], category: 'identity', type: 'Driving Licence', expiry: plusYears(3, 4), fields: { holder, number: 'DL-0420190012345', country: 'India', issuer: 'RTO Chennai' }, fav: true },
    { name: 'Residence Visa', tags: ['uae', 'travel', 'renewal'], category: 'travel', type: 'Visa', expiry: plusYears(0, 2), fields: { holder, number: '201/2024/7/123456', country: 'United Arab Emirates', issuer: 'GDRFA Dubai' } },
    { name: 'Travel Insurance', tags: ['travel', 'insurance'], category: 'travel', type: 'Travel Insurance', expiry: plusYears(1), fields: { holder, number: 'TI-88213-AX', issuer: 'Allied Assurance' } },
    { name: 'PAN Card', tags: ['india', 'tax'], category: 'identity', type: 'PAN Card', expiry: null, fields: { holder, number: 'ABCPK1234F', country: 'India', issuer: 'Income Tax Department' } },
    { name: 'Health Insurance Policy', tags: ['insurance', 'family'], category: 'finance', type: 'Insurance', expiry: plusYears(0, 11), fields: { holder, number: 'HP-2026-55120', issuer: 'Nova Health' } },
    { name: 'Degree Certificate', tags: ['education'], category: 'personal', type: 'Educational Certificate', expiry: null, fields: { holder, issuer: 'Anna University' } },
  ];
  for (const s of samples) {
    const lines = [
      `Document type: ${s.type}`,
      `Holder: ${s.fields.holder}`,
      ...(s.fields.number ? [`Number: ${s.fields.number}`] : []),
      ...(s.fields.issuer ? [`Issued by: ${s.fields.issuer}`] : []),
      ...(s.expiry ? [`Valid until: ${s.expiry}`] : []),
    ];
    await createDocument(
      makeSamplePdf(s.name, lines),
      { name: `${s.name}.pdf`, mime: 'application/pdf' },
      { name: s.name, category: s.category, docType: s.type, expiry: s.expiry, fields: s.fields, favorite: s.fav, tags: s.tags },
    );
  }
}
