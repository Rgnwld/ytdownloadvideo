const express = require('express');
const ytdl = require('ytdl-core');
const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const path = require('path');

// Configurar o caminho do FFmpeg
ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
const port = 3000;

// Middleware para processar JSON
app.use(express.json());

// Função para extrair URLs do YouTube de uma página
async function extractYoutubeUrls(url) {
  try {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    const youtubeUrls = new Set();

    // Procurar por iframes do YouTube
    $('iframe').each((i, elem) => {
      const src = $(elem).attr('src');
      if (src && (src.includes('youtube.com') || src.includes('youtu.be'))) {
        youtubeUrls.add(src.replace('embed/', 'watch?v='));
      }
    });

    // Procurar por links do YouTube
    $('a').each((i, elem) => {
      const href = $(elem).attr('href');
      if (href && (href.includes('youtube.com/watch') || href.includes('youtu.be'))) {
        youtubeUrls.add(href);
      }
    });

    return Array.from(youtubeUrls);
  } catch (error) {
    console.error('Erro ao extrair URLs:', error);
    return [];
  }
}

// Rota básica para a página inicial
app.get('/', (req, res) => {
  res.send(`
    <h1>Download de Vídeos do YouTube</h1>
    <form action="/search" method="GET">
      <input type="text" name="url" placeholder="Cole qualquer URL aqui" style="width: 300px">
      <button type="submit">Buscar vídeos</button>
    </form>
  `);
});

// Nova rota para buscar vídeos em uma página
app.get('/search', async (req, res) => {
  try {
    const pageUrl = req.query.url;
    
    if (!pageUrl) {
      return res.status(400).send('URL não fornecida');
    }

    // Verificar se a URL é diretamente do YouTube
    const isYoutubeUrl = pageUrl.includes('youtube.com/') || 
                        pageUrl.includes('youtu.be/');

    if (isYoutubeUrl) {
      return res.send(`
        <h1>Vídeo do YouTube:</h1>
        <div style="margin: 10px 0;">
          <a href="${pageUrl}" target="_blank">${pageUrl}</a>
          <a href="/quality?url=${encodeURIComponent(pageUrl)}" style="margin-left: 10px;">
            <button>Selecionar Qualidade</button>
          </a>
        </div>
        <br>
        <a href="/">Voltar</a>
      `);
    }

    // Se não for URL do YouTube, buscar URLs na página
    const youtubeUrls = await extractYoutubeUrls(pageUrl);

    if (youtubeUrls.length === 0) {
      return res.send(`
        Nenhum vídeo do YouTube encontrado nesta página
        <br><br>
        <a href="/">Voltar</a>
      `);
    }

    // Criar HTML com lista de vídeos encontrados
    const videoList = youtubeUrls.map(url => `
      <div style="margin: 10px 0;">
        <a href="${url}" target="_blank">${url}</a>
        <a href="/quality?url=${encodeURIComponent(url)}" style="margin-left: 10px;">
          <button>Selecionar Qualidade</button>
        </a>
      </div>
    `).join('');

    res.send(`
      <h1>Vídeos encontrados:</h1>
      ${videoList}
      <br>
      <a href="/">Voltar</a>
    `);

  } catch (error) {
    console.error('Erro ao buscar vídeos:', error);
    res.status(500).send('Erro ao buscar vídeos na página');
  }
});

// Rota para mostrar as qualidades disponíveis
app.get('/quality', async (req, res) => {
  try {
    const videoURL = req.query.url;
    
    if (!videoURL) {
      return res.status(400).send('URL do vídeo não fornecida');
    }

    // Verificar se a URL é válida
    const validURL = await ytdl.validateURL(videoURL);
    if (!validURL) {
      return res.status(400).send('URL do vídeo inválida');
    }

    // Obter informações do vídeo
    const info = await ytdl.getInfo(videoURL);
    const videoTitle = info.videoDetails.title;

    // Organizar formatos de vídeo apenas
    const videoFormats = info.formats
      .filter(format => format.hasVideo && !format.hasAudio)
      .map(format => ({
        itag: format.itag,
        qualityLabel: format.qualityLabel,
        container: format.container,
        fps: format.fps || 'N/A',
        bitrate: format.bitrate ? `${(format.bitrate / 1024 / 1024).toFixed(2)} Mbps` : 'Desconhecido'
      }))
      .sort((a, b) => {
        const getQuality = (label) => parseInt(label.match(/\d+/)[0]);
        return getQuality(b.qualityLabel) - getQuality(a.qualityLabel);
      });

    // Organizar formatos de áudio apenas
    const audioFormats = info.formats
      .filter(format => !format.hasVideo && format.hasAudio)
      .map(format => ({
        itag: format.itag,
        container: format.container,
        audioBitrate: format.audioBitrate,
        audioQuality: format.audioQuality || 'N/A'
      }))
      .sort((a, b) => b.audioBitrate - a.audioBitrate);

    // Organizar formatos combinados (vídeo + áudio)
    const combinedFormats = info.formats
      .filter(format => format.hasVideo && format.hasAudio)
      .map(format => ({
        itag: format.itag,
        qualityLabel: format.qualityLabel,
        container: format.container,
        size: format.contentLength ? `${(format.contentLength / 1024 / 1024).toFixed(2)} MB` : 'Desconhecido',
        fps: format.fps || 'N/A',
        bitrate: format.bitrate ? `${(format.bitrate / 1024 / 1024).toFixed(2)} Mbps` : 'Desconhecido',
        audioQuality: format.audioQuality || 'N/A'
      }))
      .sort((a, b) => {
        const getQuality = (label) => parseInt(label.match(/\d+/)[0]);
        return getQuality(b.qualityLabel) - getQuality(a.qualityLabel);
      });

    // Função para criar HTML dos formatos de vídeo
    const createVideoFormatHTML = (format) => `
      <div style="margin: 10px 0; padding: 10px; border: 1px solid #ccc; border-radius: 5px;">
        <div>
          <strong>Qualidade: ${format.qualityLabel}</strong>
          <span style="margin-left: 15px">FPS: ${format.fps}</span>
        </div>
        <div style="margin-top: 5px; font-size: 0.9em; color: #666;">
          <span>Formato: ${format.container}</span>
          <span style="margin-left: 15px">Bitrate: ${format.bitrate}</span>
        </div>
        <div style="margin-top: 10px;">
          <select id="audio-select-${format.itag}" style="margin-right: 10px;">
            <option value="">Selecione a qualidade do áudio</option>
            ${audioFormats.map(audio => 
              `<option value="${audio.itag}">
                ${audio.audioQuality} - ${audio.audioBitrate}kbps
              </option>`
            ).join('')}
          </select>
          <a href="/download-merge?url=${encodeURIComponent(videoURL)}&videoItag=${format.itag}" 
             onclick="this.href += '&audioItag=' + document.getElementById('audio-select-${format.itag}').value">
            <button>Download com Áudio</button>
          </a>
        </div>
      </div>
    `;

    // Função para criar HTML dos formatos combinados
    const createCombinedFormatHTML = (format) => `
      <div style="margin: 10px 0; padding: 10px; border: 1px solid #ccc; border-radius: 5px;">
        <div>
          <strong>Qualidade: ${format.qualityLabel}</strong>
          <span style="margin-left: 15px">FPS: ${format.fps}</span>
        </div>
        <div style="margin-top: 5px; font-size: 0.9em; color: #666;">
          <span>Formato: ${format.container}</span>
          <span style="margin-left: 15px">Tamanho: ${format.size}</span>
          <span style="margin-left: 15px">Bitrate: ${format.bitrate}</span>
          <span style="margin-left: 15px">Áudio: ${format.audioQuality}</span>
        </div>
        <div style="margin-top: 10px;">
          <a href="/download?url=${encodeURIComponent(videoURL)}&itag=${format.itag}">
            <button>Download</button>
          </a>
        </div>
      </div>
    `;

    // Criar o HTML completo
    res.send(`
      <h1>Selecione a qualidade do vídeo:</h1>
      <h2>${videoTitle}</h2>
      
      <div style="margin: 20px 0;">
        <h3>Qualidades disponíveis (vídeo + áudio separados):</h3>
        ${videoFormats.map(createVideoFormatHTML).join('')}
      </div>

      <div style="margin: 20px 0;">
        <h3>Qualidades disponíveis (vídeo + áudio combinados):</h3>
        ${combinedFormats.map(createCombinedFormatHTML).join('')}
      </div>

      <br>
      <a href="/">Voltar</a>

      <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        button { padding: 5px 15px; cursor: pointer; }
        select { padding: 5px; min-width: 200px; }
      </style>
    `);

  } catch (error) {
    console.error('Erro ao obter qualidades:', error);
    res.status(500).send('Erro ao processar as qualidades disponíveis');
  }
});

// Nova rota para download com merge de áudio e vídeo
app.get('/download-merge', async (req, res) => {
  try {
    const videoURL = req.query.url;
    const videoItag = req.query.videoItag;
    const audioItag = req.query.audioItag;
    
    if (!videoURL || !videoItag || !audioItag) {
      return res.status(400).send('Parâmetros incompletos');
    }

    // Verificar se a URL é válida
    const validURL = await ytdl.validateURL(videoURL);
    if (!validURL) {
      return res.status(400).send('URL do vídeo inválida');
    }

    // Obter informações do vídeo
    const info = await ytdl.getInfo(videoURL);
    
    // Limpar o título do vídeo de forma mais rigorosa
    const videoTitle = info.videoDetails.title
      .replace(/[^a-zA-Z0-9]/g, '_') // Substitui caracteres especiais por underscore
      .replace(/_+/g, '_') // Remove underscores múltiplos
      .replace(/^_|_$/g, '') // Remove underscores no início e fim
      .substring(0, 100); // Limita o tamanho do título

    // Criar nomes de arquivos temporários com timestamp para evitar conflitos
    const timestamp = Date.now();
    const tempVideoPath = path.join(__dirname, `temp_video_${timestamp}.mp4`);
    const tempAudioPath = path.join(__dirname, `temp_audio_${timestamp}.mp4`);
    const outputPath = path.join(__dirname, `output_${timestamp}.mp4`);

    // Baixar vídeo e áudio separadamente
    const videoStream = ytdl(videoURL, {
      quality: videoItag,
      filter: format => format.itag === parseInt(videoItag)
    });

    const audioStream = ytdl(videoURL, {
      quality: audioItag,
      filter: format => format.itag === parseInt(audioItag)
    });

    // Salvar vídeo e áudio em arquivos temporários
    await Promise.all([
      new Promise((resolve, reject) => {
        videoStream.pipe(fs.createWriteStream(tempVideoPath))
          .on('finish', resolve)
          .on('error', reject);
      }),
      new Promise((resolve, reject) => {
        audioStream.pipe(fs.createWriteStream(tempAudioPath))
          .on('finish', resolve)
          .on('error', reject);
      })
    ]);

    // Configurar cabeçalhos para download
    res.header('Content-Disposition', `attachment; filename="${videoTitle}.mp4"`);

    // Combinar vídeo e áudio usando ffmpeg
    ffmpeg()
      .input(tempVideoPath)
      .input(tempAudioPath)
      .outputOptions('-c:v copy')
      .outputOptions('-c:a aac')
      .format('mp4')
      .on('start', (commandLine) => {
        console.log('Comando FFmpeg:', commandLine);
      })
      .on('error', (err, stdout, stderr) => {
        console.error('Erro no FFmpeg:', err);
        console.error('FFmpeg stderr:', stderr);
        // Limpar arquivos temporários em caso de erro
        try {
          if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
          if (fs.existsSync(tempAudioPath)) fs.unlinkSync(tempAudioPath);
          if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        } catch (e) {
          console.error('Erro ao limpar arquivos temporários:', e);
        }
        res.status(500).send('Erro ao processar o vídeo');
      })
      .on('end', () => {
        // Enviar o arquivo combinado
        const readStream = fs.createReadStream(outputPath);
        readStream.pipe(res);
        
        // Limpar arquivos temporários após o envio completo
        readStream.on('end', () => {
          try {
            fs.unlinkSync(tempVideoPath);
            fs.unlinkSync(tempAudioPath);
            fs.unlinkSync(outputPath);
          } catch (e) {
            console.error('Erro ao limpar arquivos temporários:', e);
          }
        });
      })
      .save(outputPath);

  } catch (error) {
    console.error('Erro ao fazer download:', error);
    res.status(500).send('Erro ao processar o download');
  }
});

// Rota de download original para formatos combinados
app.get('/download', async (req, res) => {
  try {
    const videoURL = req.query.url;
    const itag = req.query.itag;
    
    if (!videoURL) {
      return res.status(400).send('URL do vídeo não fornecida');
    }

    // Verificar se a URL é válida
    const validURL = await ytdl.validateURL(videoURL);
    if (!validURL) {
      return res.status(400).send('URL do vídeo inválida');
    }

    // Obter informações do vídeo
    const info = await ytdl.getInfo(videoURL);
    const videoTitle = info.videoDetails.title.replace(/[^\w\s]/gi, '');

    // Configurar cabeçalhos para download
    res.header('Content-Disposition', `attachment; filename="${videoTitle}.mp4"`);

    // Iniciar download com a qualidade selecionada
    ytdl(videoURL, {
      filter: format => format.itag === parseInt(itag),
      quality: itag
    }).pipe(res);

  } catch (error) {
    console.error('Erro ao fazer download:', error);
    res.status(500).send('Erro ao processar o download');
  }
});

// Iniciar o servidor
app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});
