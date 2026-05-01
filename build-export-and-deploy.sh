#!/usr/bin/env bash

set -euo pipefail

ARCHIVE_PATH="delavibe-images.tar"
IMPORT_MODE="ask"
UP_MODE="ask"

print_usage() {
  cat <<'EOF'
Uso: ./build-export-and-deploy.sh [opcoes]

Opcoes:
  --archive <arquivo>    Caminho do tar de exportacao. Padrao: delavibe-images.tar
  --import <modo>        yes | no | ask. Padrao: ask
  --up <modo>            project | seed | none | ask. Padrao: ask
  --help                 Mostra esta ajuda

Exemplos:
  ./build-export-and-deploy.sh
  ./build-export-and-deploy.sh --import yes --up project
  ./build-export-and-deploy.sh --archive /tmp/delavibe-images.tar --up seed
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --archive)
      if [[ $# -lt 2 ]]; then
        echo "Faltou valor para --archive" >&2
        exit 1
      fi
      ARCHIVE_PATH="$2"
      shift 2
      ;;
    --import)
      if [[ $# -lt 2 ]]; then
        echo "Faltou valor para --import" >&2
        exit 1
      fi
      IMPORT_MODE="$2"
      shift 2
      ;;
    --up)
      if [[ $# -lt 2 ]]; then
        echo "Faltou valor para --up" >&2
        exit 1
      fi
      UP_MODE="$2"
      shift 2
      ;;
    --help|-h)
      print_usage
      exit 0
      ;;
    *)
      echo "Opcao desconhecida: $1" >&2
      print_usage >&2
      exit 1
      ;;
  esac
done

case "$IMPORT_MODE" in
  yes|no|ask) ;;
  *)
    echo "Valor invalido para --import: $IMPORT_MODE" >&2
    exit 1
    ;;
esac

case "$UP_MODE" in
  project|seed|none|ask) ;;
  *)
    echo "Valor invalido para --up: $UP_MODE" >&2
    exit 1
    ;;
esac

echo "==> Compilando o projeto"
npm run build

echo "==> Construindo as imagens Docker"
npm run images:build

echo "==> Exportando as imagens para $ARCHIVE_PATH"
docker save -o "$ARCHIVE_PATH" delavibe/app:local delavibe/migrate:local delavibe/seed:local

if [[ "$IMPORT_MODE" == "ask" ]]; then
  read -r -p "Deseja importar agora no Docker local? [y/N] " import_answer
  case "${import_answer,,}" in
    y|yes|s|sim) IMPORT_MODE="yes" ;;
    *) IMPORT_MODE="no" ;;
  esac
fi

if [[ "$IMPORT_MODE" == "yes" ]]; then
  echo "==> Importando imagens no Docker local"
  docker load -i "$ARCHIVE_PATH"
else
  echo "==> Importacao local ignorada"
fi

if [[ "$UP_MODE" == "ask" ]]; then
  read -r -p "O que deseja subir? [project/seed/none] (padrao: project) " up_answer
  up_answer="${up_answer:-project}"
  case "$up_answer" in
    project|seed|none) UP_MODE="$up_answer" ;;
    *)
      echo "Opcao invalida: $up_answer" >&2
      exit 1
      ;;
  esac
fi

case "$UP_MODE" in
  project)
    echo "==> Subindo apenas o projeto"
    npm run up
    ;;
  seed)
    echo "==> Subindo projeto com seed"
    npm run init
    ;;
  none)
    echo "==> Nenhum container sera iniciado"
    ;;
esac

echo "==> Fluxo concluido"
