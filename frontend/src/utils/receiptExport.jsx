import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReceiptDocument from '../components/ReceiptDocument';

const safeFilename = (value) => String(value || 'Receipt')
  .trim()
  .replace(/[^a-z0-9._-]+/gi, '-')
  .replace(/-+/g, '-')
  .replace(/^-|-$/g, '');

const receiptMarkup = (props) => renderToStaticMarkup(<ReceiptDocument {...props} />);

const waitForImages = async (root) => {
  const images = Array.from(root.querySelectorAll('img'));
  await Promise.all(images.map((image) => {
    if (image.complete) return Promise.resolve();
    return new Promise((resolve) => {
      image.addEventListener('load', resolve, { once: true });
      image.addEventListener('error', resolve, { once: true });
    });
  }));
};

const waitForStylesheets = async (doc) => {
  const links = Array.from(doc.querySelectorAll('link[rel="stylesheet"]'));
  await Promise.all(links.map((link) => {
    if (link.sheet) return Promise.resolve();
    return new Promise((resolve) => {
      const timeout = window.setTimeout(resolve, 4000);
      const finish = () => {
        window.clearTimeout(timeout);
        resolve();
      };
      link.addEventListener('load', finish, { once: true });
      link.addEventListener('error', finish, { once: true });
    });
  }));
};

const stylesheetMarkup = () => Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
  .map((node) => {
    if (node.tagName === 'LINK') {
      return `<link rel="stylesheet" href="${node.href}">`;
    }
    return node.outerHTML;
  })
  .join('\n');

export const printReceipt = ({ transaction, bankAccount, settings, language }) => {
  const frame = document.createElement('iframe');
  frame.className = 'receipt-print-frame';
  frame.setAttribute('aria-hidden', 'true');
  frame.setAttribute('title', 'Receipt print document');
  Object.assign(frame.style, {
    position: 'fixed',
    right: '0',
    bottom: '0',
    width: '1px',
    height: '1px',
    border: '0',
    opacity: '0',
    pointerEvents: 'none',
  });
  document.body.appendChild(frame);

  const printWindow = frame.contentWindow;
  const printDocument = frame.contentDocument;
  if (!printWindow || !printDocument) {
    frame.remove();
    throw new Error('The receipt print document could not be created.');
  }

  let cleanupTimer;
  const cleanup = () => {
    window.clearTimeout(cleanupTimer);
    frame.remove();
  };

  printWindow.addEventListener('afterprint', cleanup, { once: true });
  cleanupTimer = window.setTimeout(cleanup, 60000);

  printDocument.open();
  printDocument.write(`<!doctype html>
    <html lang="${language || 'en'}">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>${safeFilename(transaction?.receipt_no || 'Receipt')}</title>
        <style>
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          @page {
            size: A4 portrait;
            margin: 4mm;
          }
        </style>
        ${stylesheetMarkup()}
      </head>
      <body class="receipt-standalone-page">
        ${receiptMarkup({ transaction, bankAccount, settings, language })}
      </body>
    </html>`);
  printDocument.close();

  const runPrint = async () => {
    await waitForStylesheets(printDocument);
    await waitForImages(printDocument);
    if (printDocument.fonts?.ready) await printDocument.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    printWindow.focus();
    printWindow.print();
  };

  runPrint().catch((error) => {
    cleanup();
    console.error('[v0] Failed to print receipt', error);
  });

  return () => {
    cleanup();
  };
};

export const downloadReceiptPdf = async ({ transaction, bankAccount, settings, language }) => {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);
  const stage = document.createElement('div');
  stage.className = 'receipt-pdf-stage';
  stage.setAttribute('aria-hidden', 'true');
  stage.innerHTML = receiptMarkup({ transaction, bankAccount, settings, language });
  Object.assign(stage.style, {
    position: 'absolute',
    inset: '0 auto auto 0',
    zIndex: '2147483647',
    display: 'block',
    visibility: 'visible',
    width: '194mm',
    minHeight: '100vh',
    background: '#ffffff',
  });
  document.body.appendChild(stage);

  try {
    await waitForImages(stage);
    if (document.fonts?.ready) await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const receiptNo = safeFilename(transaction?.receipt_no || 'Receipt');
    const receipt = stage.querySelector('.receipt-sheet');
    if (!receipt) throw new Error('Receipt document could not be prepared for PDF export.');
    Object.assign(receipt.style, { display: 'block', visibility: 'visible', width: '194mm', maxWidth: '194mm' });
    const bounds = receipt.getBoundingClientRect();
    if (!bounds.width || !bounds.height) {
      throw new Error(`Receipt layout has invalid dimensions (${bounds.width}x${bounds.height}).`);
    }
    const canvas = await html2canvas(receipt, {
      scale: 3.5,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      width: Math.ceil(bounds.width) + 2,
      height: Math.ceil(bounds.height) + 2,
      windowWidth: Math.ceil(bounds.width) + 20,
      windowHeight: Math.ceil(bounds.height) + 20,
      x: 0,
      y: 0,
      scrollX: 0,
      scrollY: 0,
    });
    if (!canvas.width || !canvas.height) throw new Error('Receipt rendering produced an empty canvas.');

    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
    
    const margin = 6;
    const maxImgWidth = 210 - (margin * 2);  // 198mm
    const maxImgHeight = 297 - (margin * 2); // 285mm

    const imgRatio = canvas.width / canvas.height;

    let imageWidth = maxImgWidth;
    let imageHeight = maxImgWidth / imgRatio;

    if (imageHeight > maxImgHeight) {
      imageHeight = maxImgHeight;
      imageWidth = maxImgHeight * imgRatio;
    }

    const offsetX = (210 - imageWidth) / 2;
    const offsetY = margin;

    const imageData = canvas.toDataURL('image/jpeg', 0.98);
    pdf.addImage(imageData, 'JPEG', offsetX, offsetY, imageWidth, imageHeight, undefined, 'FAST');
    pdf.save(`Sky-Ariana-Receipt-${receiptNo}.pdf`);
  } finally {
    stage.remove();
  }
};

/**
 * Format clean text summary for WhatsApp, Telegram, or SMS Hawala messaging
 */
export const formatHawalaSummary = ({ transaction, bankAccount, settings }) => {
  const company = settings?.company_name || 'Sky Ariana Limited';
  const lines = [
    `━━━━━━━━━━━━━━━━━━━━`,
    `🏛️ *${company.toUpperCase()}*`,
    `📄 *OFFICIAL MONEY RECEIPT*`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `🔢 *Receipt No:* ${transaction.receipt_no || 'DRAFT'}`,
    `📅 *Date:* ${transaction.date || new Date().toISOString().slice(0, 10)}`,
    `🔄 *Type:* ${transaction.type || 'Received'}`,
    `👤 *Customer:* ${transaction.customer_name || transaction.customer || '—'}`,
  ];

  if (transaction.company_name) {
    lines.push(`🏢 *Company:* ${transaction.company_name}`);
  }
  if (transaction.subject) {
    lines.push(`📝 *Subject:* ${transaction.subject}`);
  }
  if (transaction.receiver_name) {
    lines.push(`📥 *Receiver:* ${transaction.receiver_name}`);
  }

  lines.push(
    `💰 *Amount:* ${Number(transaction.amount || 0).toLocaleString('en-US')} ${transaction.currency || 'USD'}`
  );

  if (Number(transaction.equivalent_amount || 0) > 0) {
    lines.push(
      `💱 *Equivalent:* ${Number(transaction.equivalent_amount).toLocaleString('en-US')} ${transaction.equivalent_currency || 'Afghani'}`
    );
  }

  lines.push(`💳 *Payment Method:* ${transaction.payment_method || 'Bank Transfer'}`);

  if (bankAccount) {
    lines.push(`🏦 *Bank:* ${bankAccount.bank_name || ''} - ${bankAccount.account_number || ''}`);
  }

  lines.push(`✅ *Status:* ${transaction.status || 'Completed'}`);

  if (transaction.description) {
    lines.push(`📌 *Notes:* ${transaction.description}`);
  }

  lines.push(`━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`_Generated by Sky Banking System_`);

  return lines.join('\n');
};
