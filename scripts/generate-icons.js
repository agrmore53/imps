/**
 * Script para gerar ícones PWA a partir do SVG base
 *
 * Uso: node scripts/generate-icons.js
 *
 * Requer: npm install sharp
 */

const fs = require('fs')
const path = require('path')

// Tenta importar sharp, se não tiver instalado, dá instruções
let sharp
try {
  sharp = require('sharp')
} catch (e) {
  console.log('Sharp não está instalado. Execute:')
  console.log('npm install sharp --save-dev')
  console.log('')
  console.log('Ou gere os ícones manualmente a partir de public/icons/icon.svg')
  process.exit(1)
}

const sizes = [72, 96, 128, 144, 152, 192, 384, 512]
const inputPath = path.join(__dirname, '../public/icons/icon.svg')
const outputDir = path.join(__dirname, '../public/icons')

async function generateIcons() {
  console.log('Gerando ícones PWA...')

  // Verifica se o SVG existe
  if (!fs.existsSync(inputPath)) {
    console.error('Arquivo icon.svg não encontrado em public/icons/')
    process.exit(1)
  }

  // Lê o SVG
  const svgBuffer = fs.readFileSync(inputPath)

  // Gera cada tamanho
  for (const size of sizes) {
    const outputPath = path.join(outputDir, `icon-${size}x${size}.png`)

    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(outputPath)

    console.log(`✓ Gerado: icon-${size}x${size}.png`)
  }

  // Gera favicon.ico (usando 32x32)
  const faviconPath = path.join(__dirname, '../public/favicon.ico')
  await sharp(svgBuffer)
    .resize(32, 32)
    .png()
    .toFile(faviconPath.replace('.ico', '.png'))

  console.log('✓ Gerado: favicon.png')

  // Gera apple-touch-icon (180x180)
  const applePath = path.join(outputDir, 'apple-touch-icon.png')
  await sharp(svgBuffer)
    .resize(180, 180)
    .png()
    .toFile(applePath)

  console.log('✓ Gerado: apple-touch-icon.png')

  console.log('')
  console.log('Ícones gerados com sucesso!')
  console.log('Obs: Converta favicon.png para .ico usando um conversor online se necessário.')
}

generateIcons().catch(console.error)
