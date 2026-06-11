import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, X } from 'lucide-react';
import { useToast } from '../context/ToastContext';

export default function GoodsPanel() {
    const toast = useToast();
    const [goods, setGoods] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingGood, setEditingGood] = useState(null);

    const [form, setForm] = useState({
        name: '',
        hsn_sac: '',
        rate: 0
    });

    const fetchGoods = async () => {
        try {
            const res = await fetch('/api/goods');
            if (res.ok) {
                const data = await res.json();
                setGoods(data);
            }
        } catch (err) {
            console.error('Error fetching goods:', err);
        }
    };

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchGoods();
    }, []);

    const resetForm = () => {
        setForm({
            name: '',
            hsn_sac: '',
            rate: 0
        });
        setEditingGood(null);
    };

    const handleOpenAdd = () => {
        resetForm();
        setIsModalOpen(true);
    };

    const handleOpenEdit = (good) => {
        setEditingGood(good);
        setForm({
            name: good.name,
            hsn_sac: good.hsn_sac || '',
            rate: good.rate || 0
        });
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!form.name.trim()) {
            toast.error('Description / Name is required');
            return;
        }

        try {
            const url = editingGood ? `/api/goods/${editingGood.id}` : '/api/goods';
            const method = editingGood ? 'PUT' : 'POST';
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form)
            });

            if (res.ok) {
                toast.success(editingGood ? 'Item updated successfully!' : 'Item added successfully!');
                setIsModalOpen(false);
                resetForm();
                fetchGoods();
            } else {
                const data = await res.json();
                toast.error(data.detail || 'Failed to save item');
            }
        } catch (err) {
            console.error(err);
            toast.error('Network error, please try again');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this item?')) return;
        try {
            const res = await fetch(`/api/goods/${id}`, { method: 'DELETE' });
            if (res.ok) {
                toast.success('Item deleted successfully!');
                fetchGoods();
            } else {
                const data = await res.json();
                toast.error(data.detail || 'Failed to delete item');
            }
        } catch (err) {
            console.error(err);
            toast.error('Network error deleting item');
        }
    };

    return (
        <div className="panel">
            <div className="panel-header">
                <h2 className="panel-title">Goods & Services Catalog</h2>
                <button className="btn btn-primary" onClick={handleOpenAdd}>
                    <Plus size={16} /> Add Item
                </button>
            </div>

            <table className="data-table">
                <thead>
                    <tr>
                        <th>Description / Name</th>
                        <th>HSN/SAC Code</th>
                        <th>Default Rate (₹)</th>
                        <th style={{ width: '100px', textAlign: 'right' }}>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {goods.length === 0 ? (
                        <tr>
                            <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                                No goods or services added yet. Click "Add Item" to begin.
                            </td>
                        </tr>
                    ) : (
                        goods.map((good) => (
                            <tr key={good.id}>
                                <td className="font-bold">{good.name}</td>
                                <td><code>{good.hsn_sac || 'N/A'}</code></td>
                                <td>₹{good.rate.toFixed(2)}</td>
                                <td style={{ textAlign: 'right' }}>
                                    <div style={{ display: 'inline-flex', gap: '0.25rem' }}>
                                        <button className="btn-icon" onClick={() => handleOpenEdit(good)} title="Edit">
                                            <Edit2 size={16} />
                                        </button>
                                        <button className="btn-icon" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(good.id)} title="Delete">
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
                                {editingGood ? 'Edit Item' : 'Add New Item'}
                            </h3>
                            <button className="btn-icon" onClick={() => setIsModalOpen(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div className="form-group">
                                        <label>Description of Goods / Service *</label>
                                        <input
                                            type="text"
                                            value={form.name}
                                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                                            placeholder="e.g. M8 Steel Bolt (Grade 8.8)"
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>HSN/SAC Code</label>
                                        <input
                                            type="text"
                                            value={form.hsn_sac}
                                            onChange={(e) => setForm({ ...form, hsn_sac: e.target.value })}
                                            placeholder="e.g. 7318"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Default Rate (₹)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={form.rate}
                                            onChange={(e) => setForm({ ...form, rate: parseFloat(e.target.value) || 0 })}
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    {editingGood ? 'Update Item' : 'Add Item'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
