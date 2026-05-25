import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();

process.stdout.write(`VAPID_PUBLIC_KEY=${keys.publicKey}\n`);
process.stdout.write(`VAPID_PRIVATE_KEY=${keys.privateKey}\n`);
process.stdout.write(`VAPID_SUBJECT=mailto:contato@example.com\n`);
process.stderr.write(
  "\nGuarde essas chaves no .env. Rode uma unica vez por ambiente.\n" +
    "VAPID_PRIVATE_KEY NUNCA deve ser commitada ou logada.\n",
);
