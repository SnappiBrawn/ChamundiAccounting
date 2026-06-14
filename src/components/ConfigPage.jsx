import { useState, useEffect } from 'react';
import { Save, Mail } from 'lucide-react';
import { formatDate } from '../utils/dateFormatter';
import { useToast } from '../context/ToastContext';

export default function ConfigPage() {
    const toast = useToast();
    const [config, setConfig] = useState({
        company_name: '',
        address_line1: '',
        address_line2: '',
        address_line3: '',
        address_line4: '',
        gstin: '',
        pan: '',
        state_name: '',
        state_code: '',
        bank_name: '',
        bank_acc_no: '',
        bank_branch: '',
        bank_ifsc: '',
        bank_acc_holder: '',
        cgst_rate: 9.0,
        sgst_rate: 9.0,
        igst_rate: 18.0,
        invoice_prefix: '',
        invoice_suffix: '',
        invoice_padding: 4,
        next_sequence: 1,
        date_format: 'YYYY-MM-DD',
        phone: '',
        challan_prefix: '',
        challan_suffix: '',
        challan_padding: 4,
        next_challan_sequence: 1,
        smtp_host: 'smtp.gmail.com',
        smtp_port: 587,
        smtp_user: '',
        smtp_password: '',
        email_to: ''
    });

    const [loading, setLoading] = useState(true);
    const [activeSubTab, setActiveSubTab] = useState('company'); // 'company' | 'templates' | 'backup'

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const res = await fetch('/api/config');
                if (res.ok) {
                    const data = await res.json();
                    setConfig(data);
                } else {
                    toast.error('Failed to load configuration settings');
                }
            } catch (err) {
                console.error(err);
                toast.error('Network error reading configuration');
            } finally {
                setLoading(false);
            }
        };

        fetchConfig();
    }, [toast]);

    const handleChange = (field, val) => {
        setConfig((prev) => ({
            ...prev,
            [field]: val
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            const res = await fetch('/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });

            if (res.ok) {
                toast.success('Configuration updated successfully!');
            } else {
                toast.error('Failed to update configuration settings');
            }
        } catch (err) {
            console.error(err);
            toast.error('Network error writing configuration');
        }
    };

    const [exporting, setExporting] = useState(false);

    const handleExportEmail = async () => {
        setExporting(true);
        try {
            const res = await fetch('/api/system/export-email', {
                method: 'POST'
            });
            if (res.ok) {
                const data = await res.json();
                toast.success(data.message || 'Data exported and emailed successfully!');
            } else {
                let errMsg = 'Failed to export and email data.';
                try {
                    const data = await res.json();
                    errMsg = data.detail || errMsg;
                } catch (_) {}
                toast.error(errMsg);
            }
        } catch (err) {
            console.error(err);
            toast.error('Network error during email export');
        } finally {
            setExporting(false);
        }
    };

    if (loading) {
        return <div className="panel"><p>Loading configuration settings...</p></div>;
    }

    return (
        <div className="panel">
            <div className="panel-header">
                <h2 className="panel-title">System Settings</h2>
            </div>

            {/* Sub Tabs Navigation */}
            <div className="subtabs-container">
                <button
                    type="button"
                    className={`subtab-button ${activeSubTab === 'company' ? 'active' : ''}`}
                    onClick={() => setActiveSubTab('company')}
                >
                    Company Details
                </button>
                <button
                    type="button"
                    className={`subtab-button ${activeSubTab === 'templates' ? 'active' : ''}`}
                    onClick={() => setActiveSubTab('templates')}
                >
                    Templates & Formatting
                </button>
                <button
                    type="button"
                    className={`subtab-button ${activeSubTab === 'backup' ? 'active' : ''}`}
                    onClick={() => setActiveSubTab('backup')}
                >
                    Backup & Export
                </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {activeSubTab === 'company' && (
                    <>
                        {/* Company & Billing Address */}
                <div>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                        Company Profile & Address
                    </h3>
                    <div className="form-grid">
                        <div className="form-group" style={{ gridColumn: 'span 2' }}>
                            <label>Company Name</label>
                            <input
                                type="text"
                                value={config.company_name}
                                onChange={(e) => handleChange('company_name', e.target.value)}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Company PAN</label>
                            <input
                                type="text"
                                value={config.pan}
                                onChange={(e) => handleChange('pan', e.target.value.toUpperCase())}
                                maxLength={10}
                            />
                        </div>
                        <div className="form-group">
                            <label>GSTIN/UIN</label>
                            <input
                                type="text"
                                value={config.gstin}
                                onChange={(e) => handleChange('gstin', e.target.value.toUpperCase())}
                                maxLength={15}
                            />
                        </div>
                        <div className="form-group">
                            <label>Company Phone Number</label>
                            <input
                                type="text"
                                value={config.phone || ''}
                                onChange={(e) => handleChange('phone', e.target.value)}
                                placeholder="e.g. +91 98765 43210"
                            />
                        </div>
                        <div className="form-group">
                            <label>Address Line 1</label>
                            <input
                                type="text"
                                value={config.address_line1}
                                onChange={(e) => handleChange('address_line1', e.target.value)}
                                placeholder="Plot, building details"
                            />
                        </div>
                        <div className="form-group">
                            <label>Address Line 2</label>
                            <input
                                type="text"
                                value={config.address_line2}
                                onChange={(e) => handleChange('address_line2', e.target.value)}
                                placeholder="Area, road name"
                            />
                        </div>
                        <div className="form-group">
                            <label>Address Line 3</label>
                            <input
                                type="text"
                                value={config.address_line3}
                                onChange={(e) => handleChange('address_line3', e.target.value)}
                                placeholder="City"
                            />
                        </div>
                        <div className="form-group">
                            <label>Address Line 4</label>
                            <input
                                type="text"
                                value={config.address_line4}
                                onChange={(e) => handleChange('address_line4', e.target.value)}
                                placeholder="Postal pin code"
                            />
                        </div>
                        <div className="form-group">
                            <label>State Name</label>
                            <input
                                type="text"
                                value={config.state_name}
                                onChange={(e) => handleChange('state_name', e.target.value)}
                            />
                        </div>
                        <div className="form-group">
                            <label>State Code</label>
                            <input
                                type="text"
                                value={config.state_code}
                                onChange={(e) => handleChange('state_code', e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* Bank Account details */}
                <div>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                        Company Bank Details
                    </h3>
                    <div className="form-grid">
                        <div className="form-group">
                            <label>Account Holder Name</label>
                            <input
                                type="text"
                                value={config.bank_acc_holder || ''}
                                onChange={(e) => handleChange('bank_acc_holder', e.target.value)}
                            />
                        </div>
                        <div className="form-group">
                            <label>Bank Name</label>
                            <input
                                type="text"
                                value={config.bank_name}
                                onChange={(e) => handleChange('bank_name', e.target.value)}
                            />
                        </div>
                        <div className="form-group">
                            <label>Account Number</label>
                            <input
                                type="text"
                                value={config.bank_acc_no}
                                onChange={(e) => handleChange('bank_acc_no', e.target.value)}
                            />
                        </div>
                        <div className="form-group">
                            <label>Branch Name</label>
                            <input
                                type="text"
                                value={config.bank_branch}
                                onChange={(e) => handleChange('bank_branch', e.target.value)}
                            />
                        </div>
                        <div className="form-group">
                            <label>IFSC Code</label>
                            <input
                                type="text"
                                value={config.bank_ifsc}
                                onChange={(e) => handleChange('bank_ifsc', e.target.value.toUpperCase())}
                                maxLength={11}
                            />
                        </div>
                    </div>
                </div>

                {/* Default Tax Rates Section */}
                <div>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                        Default Tax Rates (%)
                    </h3>
                    <div className="form-grid">
                        <div className="form-group">
                            <label>CGST Rate (%)</label>
                            <input
                                type="number"
                                step="0.01"
                                value={config.cgst_rate}
                                onChange={(e) => handleChange('cgst_rate', parseFloat(e.target.value) || 0)}
                            />
                        </div>
                        <div className="form-group">
                            <label>SGST Rate (%)</label>
                            <input
                                type="number"
                                step="0.01"
                                value={config.sgst_rate}
                                onChange={(e) => handleChange('sgst_rate', parseFloat(e.target.value) || 0)}
                            />
                        </div>
                        <div className="form-group">
                            <label>IGST Rate (%)</label>
                            <input
                                type="number"
                                step="0.01"
                                value={config.igst_rate}
                                onChange={(e) => handleChange('igst_rate', parseFloat(e.target.value) || 0)}
                            />
                        </div>
                    </div>
                </div>
                    </>
                )}

                {activeSubTab === 'templates' && (
                    <>
                        {/* Numbering templates grouped side-by-side */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                    <div>
                        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                            Invoice Number Template
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div className="form-group">
                                <label>Invoice Number Prefix</label>
                                <input
                                    type="text"
                                    value={config.invoice_prefix}
                                    onChange={(e) => handleChange('invoice_prefix', e.target.value)}
                                    placeholder="e.g. CF/"
                                />
                            </div>
                            <div className="form-group">
                                <label>Invoice Number Suffix</label>
                                <input
                                    type="text"
                                    value={config.invoice_suffix}
                                    onChange={(e) => handleChange('invoice_suffix', e.target.value)}
                                    placeholder="e.g. /26-27"
                                />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div className="form-group">
                                    <label>Padding Zeroes</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="10"
                                        value={config.invoice_padding}
                                        onChange={(e) => handleChange('invoice_padding', parseInt(e.target.value) || 4)}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Next Sequence No.</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={config.next_sequence}
                                        onChange={(e) => handleChange('next_sequence', parseInt(e.target.value) || 1)}
                                    />
                                </div>
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                                Preview of next invoice: <code className="font-bold" style={{ color: 'var(--accent)' }}>
                                    {config.invoice_prefix}
                                    {String(config.next_sequence).padStart(config.invoice_padding, '0')}
                                    {config.invoice_suffix}
                                </code>
                            </div>
                        </div>
                    </div>

                    <div>
                        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                            Delivery Challan Number Template
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div className="form-group">
                                <label>Challan Number Prefix</label>
                                <input
                                    type="text"
                                    value={config.challan_prefix || ''}
                                    onChange={(e) => handleChange('challan_prefix', e.target.value)}
                                    placeholder="e.g. DC/"
                                />
                            </div>
                            <div className="form-group">
                                <label>Challan Number Suffix</label>
                                <input
                                    type="text"
                                    value={config.challan_suffix || ''}
                                    onChange={(e) => handleChange('challan_suffix', e.target.value)}
                                    placeholder="e.g. /26-27"
                                />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div className="form-group">
                                    <label>Padding Zeroes</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="10"
                                        value={config.challan_padding || 4}
                                        onChange={(e) => handleChange('challan_padding', parseInt(e.target.value) || 4)}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Next Sequence No.</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={config.next_challan_sequence || 1}
                                        onChange={(e) => handleChange('next_challan_sequence', parseInt(e.target.value) || 1)}
                                    />
                                </div>
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                                Preview of next challan: <code className="font-bold" style={{ color: 'var(--accent)' }}>
                                    {config.challan_prefix || 'DC/'}
                                    {String(config.next_challan_sequence || 1).padStart(config.challan_padding || 4, '0')}
                                    {config.challan_suffix || ''}
                                </code>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Preferences & Formatting */}
                <div>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                        Preferences & Formatting
                    </h3>
                    <div className="form-grid">
                        <div className="form-group">
                            <label>App-wide Date Format</label>
                            <select
                                value={config.date_format || 'YYYY-MM-DD'}
                                onChange={(e) => handleChange('date_format', e.target.value)}
                                style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                            >
                                <option value="YYYY-MM-DD">YYYY-MM-DD (e.g. 2026-06-11)</option>
                                <option value="DD-MM-YYYY">DD-MM-YYYY (e.g. 11-06-2026)</option>
                                <option value="DD/MM/YYYY">DD/MM/YYYY (e.g. 11/06/2026)</option>
                                <option value="MM/DD/YYYY">MM/DD/YYYY (e.g. 06/11/2026)</option>
                                <option value="DD MMM YYYY">DD MMM YYYY (e.g. 11 Jun 2026)</option>
                                <option value="MMM DD, YYYY">MMM DD, YYYY (e.g. Jun 11, 2026)</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Preview Date</label>
                            <div style={{ 
                                padding: '0.5rem 1rem', 
                                border: '1px solid var(--border-color)', 
                                borderRadius: 'var(--radius-sm)', 
                                backgroundColor: 'var(--bg-secondary)', 
                                fontWeight: 600, 
                                color: 'var(--accent)',
                                height: '38px',
                                display: 'flex',
                                alignItems: 'center'
                            }}>
                                {formatDate(new Date().toISOString().split('T')[0], config.date_format || 'YYYY-MM-DD')}
                            </div>
                        </div>
                    </div>
                </div>
                    </>
                )}

                {activeSubTab === 'backup' && (
                    <>
                        {/* SMTP Configuration */}
                <div>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                        SMTP Mailer Configuration
                    </h3>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                        Configure your SMTP server settings to automatically export all invoices and delivery challans as PDFs zipped in an archive and sent to a backup email.
                    </p>
                    <div className="form-grid">
                        <div className="form-group">
                            <label>SMTP Host</label>
                            <input
                                type="text"
                                value={config.smtp_host || 'smtp.gmail.com'}
                                onChange={(e) => handleChange('smtp_host', e.target.value)}
                                placeholder="e.g. smtp.gmail.com"
                            />
                        </div>
                        <div className="form-group">
                            <label>SMTP Port</label>
                            <input
                                type="number"
                                value={config.smtp_port || 587}
                                onChange={(e) => handleChange('smtp_port', parseInt(e.target.value) || 587)}
                            />
                        </div>
                        <div className="form-group">
                            <label>Sender Username (From Email)</label>
                            <input
                                type="email"
                                value={config.smtp_user || ''}
                                onChange={(e) => handleChange('smtp_user', e.target.value)}
                                placeholder="e.g. sender@gmail.com"
                            />
                        </div>
                        <div className="form-group">
                            <label>Sender Password / App Password</label>
                            <input
                                type="password"
                                value={config.smtp_password || ''}
                                onChange={(e) => handleChange('smtp_password', e.target.value)}
                                placeholder="Gmail App Password"
                            />
                        </div>
                        <div className="form-group" style={{ gridColumn: 'span 2' }}>
                            <label>Recipient Email (To Email)</label>
                            <input
                                type="email"
                                value={config.email_to || ''}
                                onChange={(e) => handleChange('email_to', e.target.value)}
                                placeholder="e.g. business-backup@gmail.com"
                            />
                        </div>
                    </div>

                    <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <button 
                            type="button" 
                            className="btn btn-secondary" 
                            onClick={handleExportEmail}
                            disabled={exporting}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                        >
                            <Mail size={16} /> 
                            {exporting ? 'Exporting & Emailing...' : 'Export & Email Data (.ZIP)'}
                        </button>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            Generates PDF copies of all invoices/DCs, bundles them to .ZIP, and sends to the recipient.
                        </span>
                    </div>
                </div>
                    </>
                )}
 
                <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
                    <button type="submit" className="btn btn-primary">
                        <Save size={16} /> Save Configuration
                    </button>
                </div>
            </form>
        </div>
    );
}
