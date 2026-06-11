import sqlite3
import os
import sys

# In PyInstaller, sys.frozen is True. We store the db next to the .exe for persistence.
if getattr(sys, 'frozen', False):
    DB_DIR = os.path.dirname(sys.executable)
else:
    DB_DIR = os.path.dirname(__file__)

DB_PATH = os.path.join(DB_DIR, "chamundi.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Company Config
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS company_config (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        company_name TEXT,
        address_line1 TEXT,
        address_line2 TEXT,
        address_line3 TEXT,
        address_line4 TEXT,
        gstin TEXT,
        pan TEXT,
        state_name TEXT,
        state_code TEXT,
        bank_name TEXT,
        bank_acc_no TEXT,
        bank_branch TEXT,
        bank_ifsc TEXT,
        cgst_rate REAL,
        sgst_rate REAL,
        igst_rate REAL,
        invoice_prefix TEXT,
        invoice_suffix TEXT,
        invoice_padding INTEGER,
        next_sequence INTEGER,
        date_format TEXT DEFAULT 'YYYY-MM-DD',
        phone TEXT DEFAULT '',
        challan_prefix TEXT DEFAULT 'DC/',
        challan_suffix TEXT DEFAULT '',
        challan_padding INTEGER DEFAULT 4,
        next_challan_sequence INTEGER DEFAULT 1
    )
    """)
    
    # Run migration to add date_format column to existing company_config table if it doesn't exist
    try:
        cursor.execute("ALTER TABLE company_config ADD COLUMN date_format TEXT DEFAULT 'YYYY-MM-DD'")
    except sqlite3.OperationalError:
        pass

    # Run migration to add phone column to existing company_config table if it doesn't exist
    try:
        cursor.execute("ALTER TABLE company_config ADD COLUMN phone TEXT DEFAULT ''")
    except sqlite3.OperationalError:
        pass

    # Run migrations to add challan settings columns to company_config
    try:
        cursor.execute("ALTER TABLE company_config ADD COLUMN challan_prefix TEXT DEFAULT 'DC/'")
    except sqlite3.OperationalError:
        pass
    try:
        cursor.execute("ALTER TABLE company_config ADD COLUMN challan_suffix TEXT DEFAULT ''")
    except sqlite3.OperationalError:
        pass
    try:
        cursor.execute("ALTER TABLE company_config ADD COLUMN challan_padding INTEGER DEFAULT 4")
    except sqlite3.OperationalError:
        pass
    try:
        cursor.execute("ALTER TABLE company_config ADD COLUMN next_challan_sequence INTEGER DEFAULT 1")
    except sqlite3.OperationalError:
        pass
    
    # Customers
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        address_line1 TEXT,
        address_line2 TEXT,
        address_line3 TEXT,
        state_name TEXT,
        state_code TEXT,
        gstin TEXT
    )
    """)
    
    # Goods
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS goods (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        hsn_sac TEXT,
        rate REAL DEFAULT 0.0
    )
    """)
    
    # Invoices
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_no TEXT UNIQUE,
        date TEXT,
        ref_no TEXT,
        ref_date TEXT,
        vehicle_no TEXT,
        other_ref TEXT,
        terms_delivery TEXT,
        customer_id INTEGER,
        customer_name TEXT,
        customer_address TEXT,
        customer_state TEXT,
        customer_state_code TEXT,
        customer_gstin TEXT,
        taxable_value REAL,
        cgst_rate REAL,
        cgst_value REAL,
        sgst_rate REAL,
        sgst_value REAL,
        igst_rate REAL,
        igst_value REAL,
        round_off REAL,
        total_value REAL,
        total_words TEXT,
        FOREIGN KEY(customer_id) REFERENCES customers(id)
    )
    """)
    
    # Run migrations to add ref_date and vehicle_no columns to existing invoices table if they don't exist
    try:
        cursor.execute("ALTER TABLE invoices ADD COLUMN ref_date TEXT")
    except sqlite3.OperationalError:
        pass
    try:
        cursor.execute("ALTER TABLE invoices ADD COLUMN vehicle_no TEXT")
    except sqlite3.OperationalError:
        pass
    
    # Invoice Items
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS invoice_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id INTEGER,
        sr_no INTEGER,
        description TEXT,
        hsn_sac TEXT,
        quantity REAL,
        rate REAL,
        amount REAL,
        FOREIGN KEY(invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
    )
    """)
    
    # Challans
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS challans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        challan_no TEXT UNIQUE,
        date TEXT,
        invoice_no TEXT,
        ref_no TEXT,
        ref_date TEXT,
        vehicle_no TEXT,
        terms_delivery TEXT,
        customer_id INTEGER,
        customer_name TEXT,
        customer_address TEXT,
        customer_state TEXT,
        customer_state_code TEXT,
        customer_gstin TEXT,
        total_quantity REAL,
        FOREIGN KEY(customer_id) REFERENCES customers(id)
    )
    """)
    
    # Challan Items
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS challan_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        challan_id INTEGER,
        sr_no INTEGER,
        description TEXT,
        hsn_sac TEXT,
        quantity REAL,
        FOREIGN KEY(challan_id) REFERENCES challans(id) ON DELETE CASCADE
    )
    """)
    
    # Seed Company Config if empty
    cursor.execute("SELECT COUNT(*) FROM company_config")
    if cursor.fetchone()[0] == 0:
        cursor.execute("""
        INSERT INTO company_config (
            id, company_name, address_line1, address_line2, address_line3, address_line4,
            gstin, pan, state_name, state_code,
            bank_name, bank_acc_no, bank_branch, bank_ifsc,
            cgst_rate, sgst_rate, igst_rate,
            invoice_prefix, invoice_suffix, invoice_padding, next_sequence, date_format, phone,
            challan_prefix, challan_suffix, challan_padding, next_challan_sequence
        ) VALUES (
            1, 
            'CHAMUNDI FASTENERS', 
            'Survey No:129,Shed No.28/5', 
            'Kempaiah Estate,Near BMTC Depot', 
            'Peenya 4th Phase,Peenya Industrial Area', 
            'Bengaluru-560058',
            '29BCIPN3642N1Z0', 
            'BCIPN3642N', 
            'Karnataka', 
            '29',
            'State Bank of India', 
            '12345678901', 
            'Peenya Branch', 
            'SBIN0001234',
            9.0, 9.0, 18.0,
            'CF/', 
            '', 
            4, 
            1,
            'YYYY-MM-DD',
            '9876543210',
            'DC/',
            '',
            4,
            1
        )
        """)
        
    # Seed default customers if empty
    cursor.execute("SELECT COUNT(*) FROM customers")
    if cursor.fetchone()[0] == 0:
        cursor.execute("""
        INSERT INTO customers (name, address_line1, address_line2, address_line3, state_name, state_code, gstin)
        VALUES 
        ('Acme Corporation', 'Building 4, Sector 7', 'Peenya Industrial Area', 'Bengaluru', 'Karnataka', '29', '29ACMEP1234N1Z9'),
        ('Global Logistics Corp', '12 Long Street', 'Industrial Hub', 'Mumbai', 'Maharashtra', '27', '27GLOBP5678Q2Z3')
        """)
        
    # Seed default goods if empty
    cursor.execute("SELECT COUNT(*) FROM goods")
    if cursor.fetchone()[0] == 0:
        cursor.execute("""
        INSERT INTO goods (name, hsn_sac, rate)
        VALUES 
        ('M8 Steel Bolt (Grade 8.8)', '7318', 12.50),
        ('M10 Steel Bolt (Grade 8.8)', '7318', 18.00),
        ('Hex Nut M8', '7318', 4.50),
        ('Flat Washer M8', '7318', 1.50)
        """)
        
    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()
    print("Database initialized successfully.")
