import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, X } from 'lucide-react';
import { useToast } from '../context/ToastContext';

export default function CustomerPanel() {
    const toast = useToast();
    const [customers, setCustomers] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCust, setEditingCust] = useState(null);

    const [form, setForm] = useState({
        name: '',
        address_line1: '',
        address_line2: '',
        address_line3: '',
        state_name: 'Karnataka',
        state_code: '29',
        gstin: ''
    });

    const fetchCustomers = async () => {
        try {
            const res = await fetch('/api/customers');
            if (res.ok) {
                const data = await res.json();
                setCustomers(data);
            }
        } catch (err) {
            console.error('Error fetching customers:', err);
        }
    };

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchCustomers();
    }, []);

    const resetForm = () => {
        setForm({
            name: '',
            address_line1: '',
            address_line2: '',
            address_line3: '',
            state_name: 'Karnataka',
            state_code: '29',
            gstin: ''
        });
        setEditingCust(null);
    };

    const handleOpenAdd = () => {
        resetForm();
        setIsModalOpen(true);
    };

    const handleOpenEdit = (cust) => {
        setEditingCust(cust);
        setForm({
            name: cust.name,
            address_line1: cust.address_line1 || '',
            address_line2: cust.address_line2 || '',
            address_line3: cust.address_line3 || '',
            state_name: cust.state_name || 'Karnataka',
            state_code: cust.state_code || '29',
            gstin: cust.gstin || ''
        });
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!form.name.trim()) {
            toast.error('Customer name is required');
            return;
        }

        if (form.gstin && form.gstin.length !== 15) {
            toast.error('GSTIN must be exactly 15 characters (if provided)');
            return;
        }

        try {
            const url = editingCust ? `/api/customers/${editingCust.id}` : '/api/customers';
            const method = editingCust ? 'PUT' : 'POST';
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form)
            });

            if (res.ok) {
                toast.success(editingCust ? 'Customer updated successfully!' : 'Customer added successfully!');
                setIsModalOpen(false);
                resetForm();
                fetchCustomers();
            } else {
                const data = await res.json();
                toast.error(data.detail || 'Failed to save customer');
            }
        } catch (err) {
            console.error(err);
            toast.error('Network error, please try again');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this customer?')) return;
        try {
            const res = await fetch(`/api/customers/${id}`, { method: 'DELETE' });
            if (res.ok) {
                toast.success('Customer deleted successfully!');
                fetchCustomers();
            } else {
                const data = await res.json();
                toast.error(data.detail || 'Failed to delete customer');
            }
        } catch (err) {
            console.error(err);
            toast.error('Network error deleting customer');
        }
    };

    return (
        <div className="panel">
            <div className="panel-header">
                <h2 className="panel-title">Customers Directory</h2>
                <button className="btn btn-primary" onClick={handleOpenAdd}>
                    <Plus size={16} /> Add Customer
                </button>
            </div>

            <table className="data-table">
                <thead>
                    <tr>
                        <th>Customer Name</th>
                        <th>Billing Address</th>
                        <th>State / Code</th>
                        <th>GSTIN/UIN</th>
                        <th style={{ width: '100px', textAlign: 'right' }}>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {customers.length === 0 ? (
                        <tr>
                            <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                                No customers registered yet. Click "Add Customer" to begin.
                            </td>
                        </tr>
                    ) : (
                        customers.map((cust) => (
                            <tr key={cust.id}>
                                <td className="font-bold">{cust.name}</td>
                                <td>
                                    {[cust.address_line1, cust.address_line2, cust.address_line3]
                                        .filter(Boolean)
                                        .join(', ')}
                                </td>
                                <td>{cust.state_name} ({cust.state_code})</td>
                                <td><code>{cust.gstin || 'N/A'}</code></td>
                                <td style={{ textAlign: 'right' }}>
                                    <div style={{ display: 'inline-flex', gap: '0.25rem' }}>
                                        <button className="btn-icon" onClick={() => handleOpenEdit(cust)} title="Edit">
                                            <Edit2 size={16} />
                                        </button>
                                        <button className="btn-icon" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(cust.id)} title="Delete">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>

            {isModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                                {editingCust ? 'Edit Customer' : 'Add New Customer'}
                            </h3>
                            <button className="btn-icon" onClick={() => setIsModalOpen(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div className="form-group">
                                        <label>Company/Customer Name *</label>
                                        <input
                                            type="text"
                                            value={form.name}
                                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                                            placeholder="e.g. Chamundi Steel Corp"
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Address Line 1</label>
                                        <input
                                            type="text"
                                            value={form.address_line1}
                                            onChange={(e) => setForm({ ...form, address_line1: e.target.value })}
                                            placeholder="Street address, unit number"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Address Line 2</label>
                                        <input
                                            type="text"
                                            value={form.address_line2}
                                            onChange={(e) => setForm({ ...form, address_line2: e.target.value })}
                                            placeholder="Locality, Landmark"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Address Line 3</label>
                                        <input
                                            type="text"
                                            value={form.address_line3}
                                            onChange={(e) => setForm({ ...form, address_line3: e.target.value })}
                                            placeholder="City, Pin Code"
                                        />
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <div className="form-group">
                                            <label>State Name</label>
                                            <input
                                                type="text"
                                                value={form.state_name}
                                                onChange={(e) => setForm({ ...form, state_name: e.target.value })}
                                                placeholder="e.g. Karnataka"
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>State Code</label>
                                            <input
                                                type="text"
                                                value={form.state_code}
                                                onChange={(e) => setForm({ ...form, state_code: e.target.value })}
                                                placeholder="e.g. 29"
                                            />
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label>GSTIN (15-digit Tax Code)</label>
                                        <input
                                            type="text"
                                            value={form.gstin}
                                            onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })}
                                            placeholder="e.g. 29BCIPN3642N1Z0"
                                            maxLength={15}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    {editingCust ? 'Update Customer' : 'Add Customer'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
