# Download de Vídeos do YouTube

Uma aplicação web Node.js que permite baixar vídeos do YouTube em diferentes qualidades e formatos.

## Funcionalidades

- Interface web simples e intuitiva
- Extração de URLs do YouTube de qualquer página web
- Download de vídeos em diferentes qualidades
- Opção de download separado de vídeo e áudio
- Suporte para merge de vídeo e áudio usando FFmpeg
- Processamento de vídeos individuais ou múltiplos de uma página

## Pré-requisitos

- Node.js
- FFmpeg (instalado automaticamente via `ffmpeg-static`)

## Dependências

- express
- ytdl-core
- axios
- cheerio
- fluent-ffmpeg
- ffmpeg-static

## Instalação

1. Clone o repositório:

```git clone https://github.com/Rgnwld/ytdownloadvideo.git```

2. Instale as dependências:

```npm install```bash

3. Inicie o servidor:

```node download_youtube_video.js```bash

4. Acesse a aplicação em `http://localhost:3000`

## Como Usar

1. Acesse a página inicial
2. Cole uma URL do YouTube ou uma página que contenha vídeos do YouTube
3. Selecione o vídeo desejado
4. Escolha entre:
   - Download direto (vídeo + áudio combinados)
   - Download personalizado (selecione qualidades de vídeo e áudio separadamente)
5. Aguarde o download ser concluído

## Recursos Técnicos

- Extração de URLs usando Cheerio
- Processamento de vídeo com FFmpeg
- Gerenciamento de arquivos temporários
- Tratamento de erros robusto
- Interface responsiva

