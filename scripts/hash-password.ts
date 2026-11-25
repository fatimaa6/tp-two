import { hashPassword } from "../src/server/security";

const pw = process.argv[2];
if (!pw) {
  console.error('Usage : npm run admin:hash -- "mot-de-passe-d-au-moins-12-caracteres"');
  process.exit(1);
}
console.info(await hashPassword(pw));
