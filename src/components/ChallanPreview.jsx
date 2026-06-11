import { useState, useEffect, useRef } from 'react';
import { Printer, ArrowLeft } from 'lucide-react';
import { formatDate } from '../utils/dateFormatter';

export default function ChallanPreview({ challan, companyConfig, onBack }) {
    const [rawTemplate, setRawTemplate] = useState('');
    const [loading, setLoading] = useState(true);
    const iframeRef = useRef(null);

    useEffect(() => {
        const fetchTemplate = async () => {
            try {
                const res = await fetch('/api/templates/challan');
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
        challan.items.forEach((item, index) => {
            totalQty += item.quantity;
            itemsRows += `
                <tr class="item-row">
                    <td class="col-sr border-right" style="text-align: center;">${index + 1}</td>
                    <td class="col-desc border-right">${item.description}</td>
                    <td class="col-hsn border-right" style="text-align: center;">${item.hsn_sac || ''}</td>
                    <td class="col-qty" style="text-align: right;">${item.quantity}</td>
                </tr>
            `;
        });

        // Construct spacer rows to push totals to standard height
        let spacerRows = '';
        const minRows = 12;
        const spacerCount = Math.max(0, minRows - challan.items.length);
        for (let i = 0; i < spacerCount; i++) {
            spacerRows += `
                <tr class="spacer-row">
                    <td class="col-sr border-right" style="border-bottom: none;"></td>
                    <td class="col-desc border-right" style="border-bottom: none;"></td>
                    <td class="col-hsn border-right" style="border-bottom: none;"></td>
                    <td class="col-qty" style="border-bottom: none;"></td>
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
            .replace(/{{challan_no}}/g, challan.challan_no)
            .replace(/{{date}}/g, formatDate(challan.date, companyConfig.date_format))
            .replace(/{{ref_no}}/g, challan.ref_no || '')
            .replace(/{{ref_date}}/g, formatDate(challan.ref_date, companyConfig.date_format))
            .replace(/{{vehicle_no}}/g, challan.vehicle_no || '')
            .replace(/{{terms_delivery}}/g, challan.terms_delivery || '')
            .replace(/{{customer_name}}/g, challan.customer_name)
            .replace(/{{customer_address}}/g, challan.customer_address)
            .replace(/{{customer_gstin}}/g, challan.customer_gstin || '')
            .replace(/{{customer_state_name}}/g, challan.customer_state)
            .replace(/{{customer_state_code}}/g, challan.customer_state_code)
            .replace(/{{items_rows}}/g, itemsRows)
            .replace(/{{spacer_rows}}/g, spacerRows)
            .replace(/{{total_quantity}}/g, totalQty);

        // Inject into iframe
        const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow.document;
        doc.open();
        doc.write(htmlContent);
        doc.close();

    }, [rawTemplate, challan, companyConfig]);

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
                title="Challan Print Preview"
            />
        </div>
    );
}
