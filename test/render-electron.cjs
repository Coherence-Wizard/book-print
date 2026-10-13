const { app, BrowserWindow } = require('electron');
const { resolveObjectURL } = require('node:buffer');
const fs = require('node:fs/promises');
const path = require('node:path');
app.setPath('userData', path.resolve(__dirname, '../work/electron-user-data'));
app.on('window-all-closed', () => {});
app.whenReady().then(async () => {
  const { compileManuscriptToBookHtml } = await import('@book-print/markdown');
  const { renderBookInterior, renderDocumentPdf, renderCoverImage, verify6x9PdfBuffer } = await import('@book-print/pdf');
    const { coverDocument, frontCoverDocument, COVER_THEMES } = await import('@book-print/book-layout');
  const makeWindow = () => {
    const win = new BrowserWindow({ show:false,width:640,height:920,useContentSize:true,webPreferences:{ nodeIntegration:false,contextIsolation:true,sandbox:true } });
    return { webContents:win.webContents,destroy:()=>win.destroy(),loadURL:async url=>{
      const blob=resolveObjectURL(url);
      await win.loadURL('data:text/html;base64,'+Buffer.from(await blob.text()).toString('base64'));
    } };
  };
  try {
    const out=path.resolve(__dirname,'../work/rendered');await fs.mkdir(out,{recursive:true});
    const metadata={ title:'A Book That Keeps Every Word',subtitle:'Book Print verification',author:'Test Author',includeTitlePage:true,includeCopyrightPage:true,copyrightNoticeText:'A custom notice.\nA second line.' };
    const long=Array.from({length:1700},(_,i)=>`WORD${String(i).padStart(4,'0')}`).join(' ');
    const manuscript=`# First Chapter\n\n**Bold opening** and *italic text* and ***bold italic text*** with [a clean link](chapter.html#part) [#](#).\n\n${long}\n\n///\n\n# Last Chapter\n\nLAST_SENTINEL\n\n- A list item\n- Another list item\n\n> A quoted paragraph.\n\n\`\`\`\n///\nconst x = 42;\n\`\`\``;
    const rendered=await renderBookInterior(compileManuscriptToBookHtml(manuscript,{metadata}),makeWindow);
    const verify=await verify6x9PdfBuffer(rendered.pdfBuffer);
    if(!verify.isValid||verify.pageCount!==rendered.pageCount)throw new Error(JSON.stringify(verify));
    await fs.writeFile(path.join(out,'interior.pdf'),rendered.pdfBuffer);
    const dimensions=await fs.readFile(path.resolve(__dirname,'../work/live-quote.json'),'utf8').then(s=>JSON.parse(s).coverDimensions).catch(()=>({width:928,height:666,unit:'pt'}));
    const coverConfig={mode:'generic',genericStyle:'classic',backCoverText:'BACK_COVER_SENTINEL\nA book with every word preserved, a complete back cover, and a spine sized for its page count.',spineText:'SPINE_SENTINEL'};
    const cover=await renderDocumentPdf(coverDocument(metadata,coverConfig,dimensions),makeWindow);
    await fs.writeFile(path.join(out,'cover.pdf'),cover);
    for (const [name, d] of [['thin-hardcover',{width:1008,height:774,unit:'pt'}],['booklet-cover',{width:882,height:666,unit:'pt'}]]) {
      await fs.writeFile(path.join(out,`${name}.pdf`),await renderDocumentPdf(coverDocument(metadata,coverConfig,d),makeWindow));
    }
    const image=await renderCoverImage(frontCoverDocument(metadata,{mode:'generic',genericStyle:'academic'}),makeWindow);
    if(!image.length)throw new Error('Checkout cover image is empty');
    await fs.writeFile(path.join(out,'checkout-image.png'),image);
    for (const style of Object.keys(COVER_THEMES)) {
      const front=await renderDocumentPdf(frontCoverDocument(metadata,{mode:'generic',genericStyle:style}),makeWindow);
      await fs.writeFile(path.join(out,`front-${style}.pdf`),front);
    }
    const bookletText='# Booklet One\n\nBOOKLET_FIRST\n\n///\n\n# Booklet Two\n\nBOOKLET_SECOND\n\n///\n\n# Booklet Three\n\nBOOKLET_LAST';
    const booklet=await renderBookInterior(compileManuscriptToBookHtml(bookletText,{metadata}),makeWindow,4);
    if(booklet.pageCount!==8)throw new Error(`Booklet must include all five content pages and pad to eight, got ${booklet.pageCount}`);
    await fs.writeFile(path.join(out,'booklet.pdf'),booklet.pdfBuffer);
    const huge=Array.from({length:258},(_,i)=>`# Chapter ${i+1}\n\nCHAPTER_SENTINEL_${i+1}\n\nA short paragraph with **bold** and *italic* words.`).join('\n\n');
    const hugeResult=await renderBookInterior(compileManuscriptToBookHtml(huge,{metadata}),makeWindow);
    await fs.writeFile(path.join(out,'260-pages.pdf'),hugeResult.pdfBuffer);
    await fs.writeFile(path.join(out,'metrics.json'),JSON.stringify({pageCount:rendered.pageCount,largePageCount:hugeResult.pageCount,width:verify.widthPoints,height:verify.heightPoints},null,2));
    console.log('RENDER_OK',JSON.stringify({pageCount:rendered.pageCount,largePageCount:hugeResult.pageCount}));
    app.exit(0);
  } catch(e) { console.error(e);app.exit(1); }
});
