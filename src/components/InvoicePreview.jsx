import { useState, useEffect, useRef } from 'react';
import { Printer, ArrowLeft } from 'lucide-react';
import { formatDate } from '../utils/dateFormatter';

export default function InvoicePreview({ invoice, companyConfig, onBack }) {
    const [rawTemplate, setRawTemplate] = useState('');
    const [loading, setLoading] = useState(true);
    const iframeRef = useRef(null);

    useEffect(() => {
        const fetchTemplate = async () => {
            try {
                const res = await fetch('/api/templates/invoice');
                if (res.ok) {
                    const data = await res.json();
                    setRawTemplate(data.html);
                }
            } catch (err) {
                console.error('Error fetching template:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchTemplate();
    }, []);

    useEffect(() => {
        if (!rawTemplate || !iframeRef.current) return;

        // Construct items rows
        let itemsRows = '';
        let totalQty = 0;
        invoice.items.forEach((item, index) => {
            totalQty += item.quantity;
            itemsRows += `
                <tr class="item-row">
                    <td class="col-sr border-right" style="text-align: center;">${index + 1}</td>
                    <td class="col-desc border-right">${item.description}</td>
                    <td class="col-hsn border-right" style="text-align: center;">${item.hsn_sac || ''}</td>
                    <td class="col-qty border-right" style="text-align: right;">${item.quantity}</td>
                    <td class="col-rate border-right" style="text-align: right;">${item.rate.toFixed(2)}</td>
                    <td class="col-amt" style="text-align: right;">${item.amount.toFixed(2)}</td>
                </tr>
            `;
        });

        // Construct spacer rows to push totals to standard height
        let spacerRows = '';
        const minRows = 12;
        const spacerCount = Math.max(0, minRows - invoice.items.length);
        for (let i = 0; i < spacerCount; i++) {
            spacerRows += `
                <tr class="spacer-row">
                    <td class="col-sr border-right" style="border-bottom: none;"></td>
                    <td class="col-desc border-right" style="border-bottom: none;"></td>
                    <td class="col-hsn border-right" style="border-bottom: none;"></td>
                    <td class="col-qty border-right" style="border-bottom: none;"></td>
                    <td class="col-rate border-right" style="border-bottom: none;"></td>
                    <td class="col-amt" style="border-bottom: none;"></td>
                </tr>
            `;
        }

        // Construct tax rows
        let taxRows = '';
        if (invoice.cgst_value > 0) {
            taxRows += `
                <tr>
                    <td class="col-sr border-right"></td>
                    <td class="col-desc border-right font-bold text-right" style="text-align: right;">CGST @ ${invoice.cgst_rate}%</td>
                    <td class="col-hsn border-right"></td>
                    <td class="col-qty border-right"></td>
                    <td class="col-rate border-right"></td>
                    <td class="col-amt font-bold text-right" style="text-align: right;">${invoice.cgst_value.toFixed(2)}</td>
                </tr>
                <tr>
                    <td class="col-sr border-right"></td>
                    <td class="col-desc border-right font-bold text-right" style="text-align: right;">SGST @ ${invoice.sgst_rate}%</td>
                    <td class="col-hsn border-right"></td>
                    <td class="col-qty border-right"></td>
                    <td class="col-rate border-right"></td>
                    <td class="col-amt font-bold text-right" style="text-align: right;">${invoice.sgst_value.toFixed(2)}</td>
                </tr>
            `;
        }
        if (invoice.igst_value > 0) {
            taxRows += `
                <tr>
                    <td class="col-sr border-right"></td>
                    <td class="col-desc border-right font-bold text-right" style="text-align: right;">IGST @ ${invoice.igst_rate}%</td>
                    <td class="col-hsn border-right"></td>
                    <td class="col-qty border-right"></td>
                    <td class="col-rate border-right"></td>
                    <td class="col-amt font-bold text-right" style="text-align: right;">${invoice.igst_value.toFixed(2)}</td>
                </tr>
            `;
        }
        if (invoice.round_off !== 0) {
            taxRows += `
                <tr>
                    <td class="col-sr border-right"></td>
                    <td class="col-desc border-right font-bold text-right" style="text-align: right;">Round off</td>
                    <td class="col-hsn border-right"></td>
                    <td class="col-qty border-right"></td>
                    <td class="col-rate border-right"></td>
                    <td class="col-amt font-bold text-right" style="text-align: right;">${invoice.round_off.toFixed(2)}</td>
                </tr>
            `;
        }

        // Interpolate variables
        let htmlContent = rawTemplate
            .replace(/{{company_name}}/g, companyConfig.company_name)
            .replace(/{{address_line1}}/g, companyConfig.address_line1)
            .replace(/{{address_line2}}/g, companyConfig.address_line2)
            .replace(/{{address_line3}}/g, companyConfig.address_line3)
            .replace(/{{address_line4}}/g, companyConfig.address_line4)
            .replace(/{{company_gstin}}/g, companyConfig.gstin)
            .replace(/{{company_state_name}}/g, companyConfig.state_name)
            .replace(/{{company_state_code}}/g, companyConfig.state_code)
            .replace(/{{company_pan}}/g, companyConfig.pan)
            .replace(/{{company_phone}}/g, companyConfig.phone || '')
            .replace(/{{invoice_no}}/g, invoice.invoice_no)
            .replace(/{{date}}/g, formatDate(invoice.date, companyConfig.date_format))
            .replace(/{{ref_no}}/g, invoice.ref_no || '')
            .replace(/{{ref_date}}/g, formatDate(invoice.ref_date, companyConfig.date_format))
            .replace(/{{vehicle_no}}/g, invoice.vehicle_no || '')
            .replace(/{{other_ref}}/g, invoice.other_ref || '')
            .replace(/{{terms_delivery}}/g, invoice.terms_delivery || '')
            .replace(/{{customer_name}}/g, invoice.customer_name)
            .replace(/{{customer_address}}/g, invoice.customer_address)
            .replace(/{{customer_gstin}}/g, invoice.customer_gstin || '')
            .replace(/{{customer_state_name}}/g, invoice.customer_state)
            .replace(/{{customer_state_code}}/g, invoice.customer_state_code)
            .replace(/{{items_rows}}/g, itemsRows)
            .replace(/{{spacer_rows}}/g, spacerRows)
            .replace(/{{total_quantity}}/g, totalQty)
            .replace(/{{taxable_value}}/g, invoice.taxable_value.toFixed(2))
            .replace(/{{tax_rows}}/g, taxRows)
            .replace(/{{total_value}}/g, invoice.total_value.toFixed(2))
            .replace(/{{total_words}}/g, invoice.total_words)
            .replace(/{{bank_name}}/g, companyConfig.bank_name)
            .replace(/{{bank_acc_no}}/g, companyConfig.bank_acc_no)
            .replace(/{{bank_branch}}/g, companyConfig.bank_branch)
            .replace(/{{bank_ifsc}}/g, companyConfig.bank_ifsc);

        // Inject into iframe
        const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow.document;
        doc.open();
        doc.write(htmlContent);
        doc.close();

    }, [rawTemplate, invoice, companyConfig]);

    const handlePrint = () => {
        if (iframeRef.current) {
            iframeRef.current.contentWindow.focus();
            iframeRef.current.contentWindow.print();
        }
    };

    if (loading) {
        return <div className="panel"><p>Loading print preview template...</p></div>;
    }

    return (
        <div>
            <div className="preview-actions">
                <button className="btn btn-secondary" onClick={onBack}>
                    <ArrowLeft size={16} /> Back
                </button>
                <button className="btn btn-primary" onClick={handlePrint}>
                    <Printer size={16} /> Print / Save PDF
                </button>
            </div>
            <iframe
                ref={iframeRef}
                className="preview-iframe"
                title="Invoice Print Preview"
            />
        </div>
    );
}
