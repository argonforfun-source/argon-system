/**
 * ARGON MEDICAL OS — Enterprise Features v4.0
 * PDF Generation (RTL), Excel Export, Advanced Optimizations
 */

const ArgonEnterprise = {
    // ── 1. PDF INVOICING (RTL) ──
    PDF: {
        async generateInvoice(clinicSettings, patientData, items, total, invoiceNo) {
            // Create a hidden div for the invoice
            const div = document.createElement('div');
            div.style.position = 'absolute';
            div.style.left = '-9999px';
            div.style.top = '0';
            div.style.width = '800px';
            div.style.background = '#fff';
            div.style.color = '#000';
            div.style.fontFamily = "'Tajawal', sans-serif";
            div.dir = 'rtl';
            
            const dateStr = new Date().toLocaleDateString('ar-JO');
            const itemsHtml = items.map((i, idx) => `
                <tr style="border-bottom:1px solid #ddd">
                    <td style="padding:10px">${idx+1}</td>
                    <td style="padding:10px">${i.name}</td>
                    <td style="padding:10px">${i.qty}</td>
                    <td style="padding:10px">${i.price} JOD</td>
                    <td style="padding:10px">${(i.qty * i.price).toFixed(2)} JOD</td>
                </tr>
            `).join('');

            div.innerHTML = `
                <div style="padding:40px;border:2px solid #0d9488;border-radius:12px;margin:20px">
                    <div style="display:flex;justify-content:space-between;border-bottom:2px solid #0d9488;padding-bottom:20px;margin-bottom:20px">
                        <div>
                            <h1 style="color:#0d9488;margin:0">${clinicSettings.name}</h1>
                            <p style="margin:5px 0;color:#555">${clinicSettings.address || ''} | ${clinicSettings.phone || ''}</p>
                        </div>
                        <div style="text-align:left">
                            <h2 style="margin:0;color:#333">فاتورة ضريبية</h2>
                            <p style="margin:5px 0;color:#555">رقم: ${invoiceNo}</p>
                            <p style="margin:5px 0;color:#555">التاريخ: ${dateStr}</p>
                        </div>
                    </div>
                    
                    <div style="margin-bottom:30px;background:#f8f9fa;padding:15px;border-radius:8px">
                        <h3 style="margin:0 0 10px;color:#0d9488">بيانات المريض:</h3>
                        <p style="margin:0"><strong>الاسم:</strong> ${patientData.name}</p>
                        <p style="margin:5px 0 0"><strong>الهاتف:</strong> ${patientData.phone}</p>
                    </div>

                    <table style="width:100%;border-collapse:collapse;margin-bottom:30px;text-align:right">
                        <thead>
                            <tr style="background:#0d9488;color:#fff">
                                <th style="padding:10px">#</th>
                                <th style="padding:10px">البيان</th>
                                <th style="padding:10px">الكمية</th>
                                <th style="padding:10px">السعر الإفرادي</th>
                                <th style="padding:10px">المجموع</th>
                            </tr>
                        </thead>
                        <tbody>${itemsHtml}</tbody>
                    </table>

                    <div style="display:flex;justify-content:flex-end">
                        <div style="width:300px;background:#f8f9fa;padding:20px;border-radius:8px;border:1px solid #ddd">
                            <h2 style="margin:0;color:#0d9488;display:flex;justify-content:space-between">
                                <span>الإجمالي:</span>
                                <span>${total.toFixed(2)} JOD</span>
                            </h2>
                        </div>
                    </div>
                    
                    <div style="margin-top:50px;text-align:center;color:#777;font-size:12px;border-top:1px solid #ddd;padding-top:20px">
                        شكراً لثقتكم بنا. مع تمنياتنا لكم بالصحة والعافية.
                        <br>تم إنشاء هذه الفاتورة بواسطة ARGON Medical OS
                    </div>
                </div>
            `;
            
            document.body.appendChild(div);

            // Load html2pdf script dynamically
            if (typeof window.html2pdf === 'undefined') {
                await this._loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js');
            }

            const opt = {
                margin: 0,
                filename: `Invoice_${invoiceNo}_${patientData.name}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
            };

            await window.html2pdf().set(opt).from(div).save();
            document.body.removeChild(div);
        },

        _loadScript(src) {
            return new Promise((resolve, reject) => {
                const s = document.createElement('script');
                s.src = src;
                s.onload = resolve;
                s.onerror = reject;
                document.head.appendChild(s);
            });
        }
    },

    // ── 2. EXCEL EXPORT (RTL) ──
    Excel: {
        async exportTable(dataArray, filename, sheetName = 'Sheet1') {
            if (typeof window.XLSX === 'undefined') {
                await ArgonEnterprise.PDF._loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
            }

            const wb = window.XLSX.utils.book_new();
            wb.Workbook = { Views: [{ RTL: true }] }; // Force RTL view in Excel

            const ws = window.XLSX.utils.json_to_sheet(dataArray);
            
            // Auto-size columns based on content length
            const colWidths = [];
            dataArray.forEach(row => {
                Object.keys(row).forEach((key, i) => {
                    const valStr = String(row[key]);
                    colWidths[i] = Math.max(colWidths[i] || 0, valStr.length, key.length);
                });
            });
            ws['!cols'] = colWidths.map(w => ({ wch: w + 5 })); // Add padding

            window.XLSX.utils.book_append_sheet(wb, ws, sheetName);
            window.XLSX.writeFile(wb, `${filename}.xlsx`);
        }
    },

    // ── 3. ADVANCED CACHING & PERFORMANCE (IndexedDB fallback) ──
    Cache: {
        async init() {
            // Simple LRU cache wrapper over localStorage for extremely fast reads of static clinical data
            // (e.g. catalog, templates) to prevent waiting for Firebase on reload
            if (!window._argonCache) window._argonCache = {};
        },
        set(key, data) {
            try {
                localStorage.setItem(`ARGON_CACHE_${key}`, JSON.stringify({
                    ts: Date.now(), data
                }));
                window._argonCache[key] = data;
            } catch(e) {}
        },
        get(key, maxAgeHours = 24) {
            if (window._argonCache[key]) return window._argonCache[key];
            try {
                const raw = localStorage.getItem(`ARGON_CACHE_${key}`);
                if (!raw) return null;
                const parsed = JSON.parse(raw);
                if (Date.now() - parsed.ts > maxAgeHours * 3600000) return null; // expired
                window._argonCache[key] = parsed.data;
                return parsed.data;
            } catch(e) { return null; }
        }
    }
};

window.ArgonEnterprise = ArgonEnterprise;
