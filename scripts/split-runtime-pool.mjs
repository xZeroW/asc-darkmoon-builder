import { mkdir, readFile, writeFile } from 'node:fs/promises'

const sourcePath = new URL('../data/darkmoon-card-pool.json', import.meta.url)
const outputDirectory = new URL('../data/cards/', import.meta.url)
const pool = JSON.parse(await readFile(sourcePath, 'utf8'))

await mkdir(outputDirectory, { recursive: true })
for (const category of ['starter_skill', 'ability', 'talent']) {
  const records = pool.records.filter((card) => card.category === category)
  await writeFile(
    new URL(`${category}.json`, outputDirectory),
    `${JSON.stringify({ records }, null, 2)}\n`,
  )
}
