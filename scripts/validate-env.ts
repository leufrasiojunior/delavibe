// Roda no entrypoint do container ANTES de qualquer migracao ou start
// do servidor. Se faltar variavel obrigatoria ou houver valor invalido,
// imprime mensagem clara e encerra com exit code 1 (impede o boot).
import "dotenv/config";

import { assertEnv } from "../lib/env";

assertEnv();
process.stdout.write("[env] Variaveis de ambiente validadas com sucesso.\n");
