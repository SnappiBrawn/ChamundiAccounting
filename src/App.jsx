import { useState } from 'react';
import Navigation from './components/Navigation';
import InvoiceForm from './components/InvoiceForm';
import ChallanForm from './components/ChallanForm';
import CustomerPanel from './components/CustomerPanel';
import GoodsPanel from './components/GoodsPanel';
import ConfigPage from './components/ConfigPage';
import UpdateNotifier from './components/UpdateNotifier';
import { ToastProvider } from './context/ToastContext';

function App() {
    const [activeTab, setActiveTab] = useState('invoices');

    const renderContent = () => {
        switch (activeTab) {
            case 'invoices':
                return <InvoiceForm />;
            case 'challans':
                return <ChallanForm />;
            case 'customers':
                return <CustomerPanel />;
            case 'goods':
                return <GoodsPanel />;
            case 'config':
                return <ConfigPage />;
            default:
                return <InvoiceForm />;
        }
    };

    return (
        <ToastProvider>
            <div className="app-container">
                <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
                <main className="main-content">
                    {renderContent()}
                </main>
                <UpdateNotifier />
            </div>
        </ToastProvider>
    );
}

export default App;
