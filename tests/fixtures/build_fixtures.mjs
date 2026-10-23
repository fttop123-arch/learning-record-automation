// 실제 직원정보를 읽지 않고 명시적인 TEST 값으로만 가상 Excel을 만든다.
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
const root = process.env.USERPROFILE;
const require = createRequire(path.join(root, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json'));
const { Workbook, SpreadsheetFile } = await import(pathToFileURL(require.resolve('@oai/artifact-tool')).href);
const output = path.dirname(fileURLToPath(import.meta.url));
const datasets = {
  'employees.xlsx': [
    ['부서', '성명', '개인식별번호'],
    ['디지털정책과', '김지현', 'TEST001'],
    ['디지털정책과', '문형식', 'TEST002'],
    ['경제정책과', '김지현', 'TEST003'],
    ['디지털정책과', '테스트빈번호', null],
  ],
  'employees_duplicate.xlsx': [
    ['부서', '성명', '개인식별번호'],
    ['디지털정책과', '김지현', 'TEST001'],
    ['디지털정책과', '김지현', 'TEST004'],
    ['디지털정책과', '문형식', 'TEST002'],
    ['경제정책과', '김지현', 'TEST003'],
  ],
  'employees_mapping.xlsx': [
    ['소속부서', '직원명', '내부번호'],
    ['디지털정책과', '김지현', 'TEST001'],
  ],
};
for (const [name, rows] of Object.entries(datasets)) {
  const workbook = Workbook.create();
  const sheet = workbook.worksheets.add('가상직원정보');
  sheet.getRange(`A1:C${rows.length}`).values = rows;
  workbook.recalculate();
  const file = await SpreadsheetFile.exportXlsx(workbook);
  await file.save(path.join(output, name));
  console.log(`가상 fixture 생성: ${name}`);
}
