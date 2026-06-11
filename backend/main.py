from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from typing import List, Optional
import os
import sys
import sqlite3
import httpx
import subprocess
from database import get_db_connection, init_db

CURRENT_VERSION = "v1.0.3"
GITHUB_REPO_API = "https://api.github.com/repos/snappibrawn/chamundiaccounting/releases/latest"


# Initialize database
init_db()

app = FastAPI(title="Chamundi Invoicing & Accounting API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic Schemas
class UpdateDownloadSchema(BaseModel):
    download_url: str

class CompanyConfigSchema(BaseModel):
    company_name: str
    address_line1: str
    address_line2: str
    address_line3: str
    address_line4: str
    gstin: str
    pan: str
    state_name: str
    state_code: str
    bank_name: str
    bank_acc_no: str
    bank_branch: str
    bank_ifsc: str
    cgst_rate: float
    sgst_rate: float
    igst_rate: float
    invoice_prefix: str
    invoice_suffix: str
    invoice_padding: int
    next_sequence: int
    date_format: str
    phone: str
    challan_prefix: str
    challan_suffix: str
    challan_padding: int
    next_challan_sequence: int

class CustomerSchema(BaseModel):
    name: str
    address_line1: Optional[str] = ""
    address_line2: Optional[str] = ""
    address_line3: Optional[str] = ""
    state_name: Optional[str] = ""
    state_code: Optional[str] = ""
    gstin: Optional[str] = ""

class CustomerResponse(CustomerSchema):
    id: int

class GoodSchema(BaseModel):
    name: str
    hsn_sac: Optional[str] = ""
    rate: float = 0.0

class GoodResponse(GoodSchema):
    id: int

class InvoiceItemSchema(BaseModel):
    sr_no: int
    description: str
    hsn_sac: Optional[str] = ""
    quantity: float
    rate: float
    amount: float

class InvoiceCreateSchema(BaseModel):
    invoice_no: str
    date: str
    ref_no: Optional[str] = ""
    ref_date: Optional[str] = ""
    vehicle_no: Optional[str] = ""
    other_ref: Optional[str] = ""
    terms_delivery: Optional[str] = ""
    customer_id: int
    customer_name: str
    customer_address: str
    customer_state: str
    customer_state_code: str
    customer_gstin: str
    taxable_value: float
    cgst_rate: float
    cgst_value: float
    sgst_rate: float
    sgst_value: float
    igst_rate: float
    igst_value: float
    round_off: float
    total_value: float
    total_words: str
    items: List[InvoiceItemSchema]
    create_dc: Optional[bool] = False

class InvoiceListItem(BaseModel):
    id: int
    invoice_no: str
    date: str
    customer_name: str
    total_value: float

class InvoiceDetailResponse(BaseModel):
    id: int
    invoice_no: str
    date: str
    ref_no: Optional[str]
    ref_date: Optional[str]
    vehicle_no: Optional[str]
    other_ref: Optional[str]
    terms_delivery: Optional[str]
    customer_id: Optional[int]
    customer_name: str
    customer_address: str
    customer_state: str
    customer_state_code: str
    customer_gstin: str
    taxable_value: float
    cgst_rate: float
    cgst_value: float
    sgst_rate: float
    sgst_value: float
    igst_rate: float
    igst_value: float
    round_off: float
    total_value: float
    total_words: str
    items: List[InvoiceItemSchema]

class ChallanItemSchema(BaseModel):
    sr_no: int
    description: str
    hsn_sac: Optional[str] = ""
    quantity: float

class ChallanCreateSchema(BaseModel):
    challan_no: str
    date: str
    invoice_no: Optional[str] = ""
    ref_no: Optional[str] = ""
    ref_date: Optional[str] = ""
    vehicle_no: Optional[str] = ""
    terms_delivery: Optional[str] = ""
    customer_id: int
    customer_name: str
    customer_address: str
    customer_state: str
    customer_state_code: str
    customer_gstin: str
    total_quantity: float
    items: List[ChallanItemSchema]

class ChallanListItem(BaseModel):
    id: int
    challan_no: str
    date: str
    customer_name: str
    total_quantity: float

class ChallanDetailResponse(BaseModel):
    id: int
    challan_no: str
    date: str
    invoice_no: Optional[str] = ""
    ref_no: Optional[str] = ""
    ref_date: Optional[str] = ""
    vehicle_no: Optional[str] = ""
    terms_delivery: Optional[str] = ""
    customer_id: Optional[int]
    customer_name: str
    customer_address: str
    customer_state: str
    customer_state_code: str
    customer_gstin: str
    total_quantity: float
    items: List[ChallanItemSchema]

# Company Config API
@app.get("/api/config", response_model=CompanyConfigSchema)
def get_config():
    conn = get_db_connection()
    row = conn.execute("SELECT * FROM company_config WHERE id = 1").fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Config not found")
    return dict(row)

@app.post("/api/config")
def update_config(config: CompanyConfigSchema):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    UPDATE company_config SET
        company_name = ?, address_line1 = ?, address_line2 = ?, address_line3 = ?, address_line4 = ?,
        gstin = ?, pan = ?, state_name = ?, state_code = ?,
        bank_name = ?, bank_acc_no = ?, bank_branch = ?, bank_ifsc = ?,
        cgst_rate = ?, sgst_rate = ?, igst_rate = ?,
        invoice_prefix = ?, invoice_suffix = ?, invoice_padding = ?, next_sequence = ?,
        date_format = ?, phone = ?,
        challan_prefix = ?, challan_suffix = ?, challan_padding = ?, next_challan_sequence = ?
    WHERE id = 1
    """, (
        config.company_name, config.address_line1, config.address_line2, config.address_line3, config.address_line4,
        config.gstin, config.pan, config.state_name, config.state_code,
        config.bank_name, config.bank_acc_no, config.bank_branch, config.bank_ifsc,
        config.cgst_rate, config.sgst_rate, config.igst_rate,
        config.invoice_prefix, config.invoice_suffix, config.invoice_padding, config.next_sequence,
        config.date_format, config.phone,
        config.challan_prefix, config.challan_suffix, config.challan_padding, config.next_challan_sequence
    ))
    conn.commit()
    conn.close()
    return {"status": "success", "message": "Configuration updated successfully"}

# Customers API
@app.get("/api/customers", response_model=List[CustomerResponse])
def get_customers():
    conn = get_db_connection()
    rows = conn.execute("SELECT * FROM customers ORDER BY name ASC").fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.post("/api/customers", response_model=CustomerResponse)
def create_customer(cust: CustomerSchema):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO customers (name, address_line1, address_line2, address_line3, state_name, state_code, gstin)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (cust.name, cust.address_line1, cust.address_line2, cust.address_line3, cust.state_name, cust.state_code, cust.gstin))
    new_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return {**cust.dict(), "id": new_id}

@app.put("/api/customers/{customer_id}", response_model=CustomerResponse)
def update_customer(customer_id: int, cust: CustomerSchema):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    UPDATE customers SET
        name = ?, address_line1 = ?, address_line2 = ?, address_line3 = ?, state_name = ?, state_code = ?, gstin = ?
    WHERE id = ?
    """, (cust.name, cust.address_line1, cust.address_line2, cust.address_line3, cust.state_name, cust.state_code, cust.gstin, customer_id))
    if cursor.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="Customer not found")
    conn.commit()
    conn.close()
    return {**cust.dict(), "id": customer_id}

@app.delete("/api/customers/{customer_id}")
def delete_customer(customer_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM customers WHERE id = ?", (customer_id,))
    if cursor.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="Customer not found")
    conn.commit()
    conn.close()
    return {"status": "success", "message": "Customer deleted successfully"}

# Goods API
@app.get("/api/goods", response_model=List[GoodResponse])
def get_goods():
    conn = get_db_connection()
    rows = conn.execute("SELECT * FROM goods ORDER BY name ASC").fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.post("/api/goods", response_model=GoodResponse)
def create_good(good: GoodSchema):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO goods (name, hsn_sac, rate)
    VALUES (?, ?, ?)
    """, (good.name, good.hsn_sac, good.rate))
    new_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return {**good.dict(), "id": new_id}

@app.put("/api/goods/{good_id}", response_model=GoodResponse)
def update_good(good_id: int, good: GoodSchema):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    UPDATE goods SET
        name = ?, hsn_sac = ?, rate = ?
    WHERE id = ?
    """, (good.name, good.hsn_sac, good.rate, good_id))
    if cursor.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="Good not found")
    conn.commit()
    conn.close()
    return {**good.dict(), "id": good_id}

@app.delete("/api/goods/{good_id}")
def delete_good(good_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM goods WHERE id = ?", (good_id,))
    if cursor.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="Good not found")
    conn.commit()
    conn.close()
    return {"status": "success", "message": "Good deleted successfully"}

# Invoice formatting and next sequence API
@app.get("/api/invoices/next-number")
def get_next_invoice_number():
    conn = get_db_connection()
    config = conn.execute("SELECT invoice_prefix, invoice_suffix, invoice_padding, next_sequence FROM company_config WHERE id = 1").fetchone()
    conn.close()
    if not config:
        raise HTTPException(status_code=404, detail="Company config not found")
    
    prefix = config["invoice_prefix"] or ""
    suffix = config["invoice_suffix"] or ""
    padding = config["invoice_padding"]
    seq = config["next_sequence"]
    
    formatted_seq = str(seq).zfill(padding)
    invoice_no = f"{prefix}{formatted_seq}{suffix}"
    
    return {
        "invoice_no": invoice_no,
        "next_sequence": seq,
        "prefix": prefix,
        "suffix": suffix,
        "padding": padding
    }

# Invoices API
@app.get("/api/invoices", response_model=List[InvoiceListItem])
def get_invoices():
    conn = get_db_connection()
    rows = conn.execute("""
        SELECT id, invoice_no, date, customer_name, total_value 
        FROM invoices 
        ORDER BY id DESC
    """).fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.get("/api/invoices/{invoice_id}", response_model=InvoiceDetailResponse)
def get_invoice(invoice_id: int):
    conn = get_db_connection()
    invoice_row = conn.execute("SELECT * FROM invoices WHERE id = ?", (invoice_id,)).fetchone()
    if not invoice_row:
        conn.close()
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    item_rows = conn.execute("SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY sr_no ASC", (invoice_id,)).fetchall()
    conn.close()
    
    return {
        **dict(invoice_row),
        "items": [dict(r) for r in item_rows]
    }

@app.post("/api/invoices")
def create_invoice(invoice: InvoiceCreateSchema):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Insert invoice header
        cursor.execute("""
        INSERT INTO invoices (
            invoice_no, date, ref_no, ref_date, vehicle_no, other_ref, terms_delivery, customer_id,
            customer_name, customer_address, customer_state, customer_state_code, customer_gstin,
            taxable_value, cgst_rate, cgst_value, sgst_rate, sgst_value, igst_rate, igst_value,
            round_off, total_value, total_words
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            invoice.invoice_no, invoice.date, invoice.ref_no, invoice.ref_date, invoice.vehicle_no, invoice.other_ref, invoice.terms_delivery, invoice.customer_id,
            invoice.customer_name, invoice.customer_address, invoice.customer_state, invoice.customer_state_code, invoice.customer_gstin,
            invoice.taxable_value, invoice.cgst_rate, invoice.cgst_value, invoice.sgst_rate, invoice.sgst_value, invoice.igst_rate, invoice.igst_value,
            invoice.round_off, invoice.total_value, invoice.total_words
        ))
        
        invoice_id = cursor.lastrowid
        
        # Insert items
        for item in invoice.items:
            cursor.execute("""
            INSERT INTO invoice_items (invoice_id, sr_no, description, hsn_sac, quantity, rate, amount)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (invoice_id, item.sr_no, item.description, item.hsn_sac, item.quantity, item.rate, item.amount))
        
        # Auto-generate Delivery Challan if checked
        challan_id = None
        challan_no = None
        if invoice.create_dc:
            cfg_dc = cursor.execute("SELECT challan_prefix, challan_suffix, challan_padding, next_challan_sequence FROM company_config WHERE id = 1").fetchone()
            dc_prefix = cfg_dc["challan_prefix"] or ""
            dc_suffix = cfg_dc["challan_suffix"] or ""
            dc_padding = cfg_dc["challan_padding"]
            dc_seq = cfg_dc["next_challan_sequence"]
            
            challan_no = f"{dc_prefix}{str(dc_seq).zfill(dc_padding)}{dc_suffix}"
            total_qty = sum(item.quantity for item in invoice.items)
            
            cursor.execute("""
            INSERT INTO challans (
                challan_no, date, invoice_no, ref_no, ref_date, vehicle_no, terms_delivery, customer_id,
                customer_name, customer_address, customer_state, customer_state_code, customer_gstin,
                total_quantity
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                challan_no, invoice.date, invoice.invoice_no, invoice.ref_no, invoice.ref_date, invoice.vehicle_no, invoice.terms_delivery, invoice.customer_id,
                invoice.customer_name, invoice.customer_address, invoice.customer_state, invoice.customer_state_code, invoice.customer_gstin,
                total_qty
            ))
            challan_id = cursor.lastrowid
            
            for item in invoice.items:
                cursor.execute("""
                INSERT INTO challan_items (challan_id, sr_no, description, hsn_sac, quantity)
                VALUES (?, ?, ?, ?, ?)
                """, (challan_id, item.sr_no, item.description, item.hsn_sac, item.quantity))
                
            cursor.execute("UPDATE company_config SET next_challan_sequence = next_challan_sequence + 1 WHERE id = 1")

        # Increment sequence if this invoice matches the next expected sequence number format
        config = cursor.execute("SELECT invoice_prefix, invoice_suffix, invoice_padding, next_sequence FROM company_config WHERE id = 1").fetchone()
        prefix = config["invoice_prefix"] or ""
        suffix = config["invoice_suffix"] or ""
        padding = config["invoice_padding"]
        seq = config["next_sequence"]
        
        expected_no = f"{prefix}{str(seq).zfill(padding)}{suffix}"
        
        if invoice.invoice_no == expected_no:
            cursor.execute("UPDATE company_config SET next_sequence = next_sequence + 1 WHERE id = 1")
            
        conn.commit()
        return {
            "status": "success", 
            "id": invoice_id, 
            "invoice_no": invoice.invoice_no,
            "challan_id": challan_id,
            "challan_no": challan_no
        }
        
    except sqlite3.IntegrityError as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=f"Invoice number already exists or integrity constraint failed: {str(e)}")
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        conn.close()

@app.put("/api/invoices/{invoice_id}")
def update_invoice(invoice_id: int, invoice: InvoiceCreateSchema):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Check if invoice exists
        existing = cursor.execute("SELECT id FROM invoices WHERE id = ?", (invoice_id,)).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Invoice not found")
            
        # Update invoice header
        cursor.execute("""
        UPDATE invoices SET
            invoice_no = ?, date = ?, ref_no = ?, ref_date = ?, vehicle_no = ?, other_ref = ?, terms_delivery = ?, customer_id = ?,
            customer_name = ?, customer_address = ?, customer_state = ?, customer_state_code = ?, customer_gstin = ?,
            taxable_value = ?, cgst_rate = ?, cgst_value = ?, sgst_rate = ?, sgst_value = ?, igst_rate = ?, igst_value = ?,
            round_off = ?, total_value = ?, total_words = ?
        WHERE id = ?
        """, (
            invoice.invoice_no, invoice.date, invoice.ref_no, invoice.ref_date, invoice.vehicle_no, invoice.other_ref, invoice.terms_delivery, invoice.customer_id,
            invoice.customer_name, invoice.customer_address, invoice.customer_state, invoice.customer_state_code, invoice.customer_gstin,
            invoice.taxable_value, invoice.cgst_rate, invoice.cgst_value, invoice.sgst_rate, invoice.sgst_value, invoice.igst_rate, invoice.igst_value,
            invoice.round_off, invoice.total_value, invoice.total_words, invoice_id
        ))
        
        # Delete old items
        cursor.execute("DELETE FROM invoice_items WHERE invoice_id = ?", (invoice_id,))
        
        # Insert new items
        for item in invoice.items:
            cursor.execute("""
            INSERT INTO invoice_items (invoice_id, sr_no, description, hsn_sac, quantity, rate, amount)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (invoice_id, item.sr_no, item.description, item.hsn_sac, item.quantity, item.rate, item.amount))
            
        conn.commit()
        return {"status": "success", "id": invoice_id, "invoice_no": invoice.invoice_no}
        
    except sqlite3.IntegrityError as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=f"Invoice number already exists or integrity constraint failed: {str(e)}")
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        conn.close()

@app.delete("/api/invoices/{invoice_id}")
def delete_invoice(invoice_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM invoices WHERE id = ?", (invoice_id,))
    if cursor.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="Invoice not found")
    conn.commit()
    conn.close()
    return {"status": "success", "message": "Invoice deleted successfully"}

# Challans API
@app.get("/api/challans", response_model=List[ChallanListItem])
def get_challans():
    conn = get_db_connection()
    rows = conn.execute("""
        SELECT id, challan_no, date, customer_name, total_quantity 
        FROM challans 
        ORDER BY id DESC
    """).fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.get("/api/challans/next-number")
def get_next_challan_number():
    conn = get_db_connection()
    config = conn.execute("SELECT challan_prefix, challan_suffix, challan_padding, next_challan_sequence FROM company_config WHERE id = 1").fetchone()
    conn.close()
    if not config:
        raise HTTPException(status_code=404, detail="Company config not found")
    
    prefix = config["challan_prefix"] or ""
    suffix = config["challan_suffix"] or ""
    padding = config["challan_padding"]
    seq = config["next_challan_sequence"]
    
    formatted_seq = str(seq).zfill(padding)
    challan_no = f"{prefix}{formatted_seq}{suffix}"
    
    return {
        "challan_no": challan_no,
        "next_challan_sequence": seq,
        "prefix": prefix,
        "suffix": suffix,
        "padding": padding
    }

@app.get("/api/challans/{challan_id}", response_model=ChallanDetailResponse)
def get_challan(challan_id: int):
    conn = get_db_connection()
    challan_row = conn.execute("SELECT * FROM challans WHERE id = ?", (challan_id,)).fetchone()
    if not challan_row:
        conn.close()
        raise HTTPException(status_code=404, detail="Challan not found")
    
    item_rows = conn.execute("SELECT * FROM challan_items WHERE challan_id = ? ORDER BY sr_no ASC", (challan_id,)).fetchall()
    conn.close()
    
    return {
        **dict(challan_row),
        "items": [dict(r) for r in item_rows]
    }

@app.post("/api/challans")
def create_challan(challan: ChallanCreateSchema):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
        INSERT INTO challans (
            challan_no, date, invoice_no, ref_no, ref_date, vehicle_no, terms_delivery, customer_id,
            customer_name, customer_address, customer_state, customer_state_code, customer_gstin,
            total_quantity
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            challan.challan_no, challan.date, challan.invoice_no, challan.ref_no, challan.ref_date, challan.vehicle_no, challan.terms_delivery, challan.customer_id,
            challan.customer_name, challan.customer_address, challan.customer_state, challan.customer_state_code, challan.customer_gstin,
            challan.total_quantity
        ))
        
        challan_id = cursor.lastrowid
        
        for item in challan.items:
            cursor.execute("""
            INSERT INTO challan_items (challan_id, sr_no, description, hsn_sac, quantity)
            VALUES (?, ?, ?, ?, ?)
            """, (challan_id, item.sr_no, item.description, item.hsn_sac, item.quantity))
            
        # Increment sequence if this challan matches next expected sequence number format
        config = cursor.execute("SELECT challan_prefix, challan_suffix, challan_padding, next_challan_sequence FROM company_config WHERE id = 1").fetchone()
        prefix = config["challan_prefix"] or ""
        suffix = config["challan_suffix"] or ""
        padding = config["challan_padding"]
        seq = config["next_challan_sequence"]
        
        expected_no = f"{prefix}{str(seq).zfill(padding)}{suffix}"
        
        if challan.challan_no == expected_no:
            cursor.execute("UPDATE company_config SET next_challan_sequence = next_challan_sequence + 1 WHERE id = 1")
            
        conn.commit()
        return {"status": "success", "id": challan_id, "challan_no": challan.challan_no}
        
    except sqlite3.IntegrityError as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=f"Challan number already exists or integrity constraint failed: {str(e)}")
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        conn.close()

@app.put("/api/challans/{challan_id}")
def update_challan(challan_id: int, challan: ChallanCreateSchema):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Check if challan exists
        existing = cursor.execute("SELECT id FROM challans WHERE id = ?", (challan_id,)).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Challan not found")
            
        cursor.execute("""
        UPDATE challans SET
            challan_no = ?, date = ?, invoice_no = ?, ref_no = ?, ref_date = ?, vehicle_no = ?, terms_delivery = ?, customer_id = ?,
            customer_name = ?, customer_address = ?, customer_state = ?, customer_state_code = ?, customer_gstin = ?,
            total_quantity = ?
        WHERE id = ?
        """, (
            challan.challan_no, challan.date, challan.invoice_no, challan.ref_no, challan.ref_date, challan.vehicle_no, challan.terms_delivery, challan.customer_id,
            challan.customer_name, challan.customer_address, challan.customer_state, challan.customer_state_code, challan.customer_gstin,
            challan.total_quantity, challan_id
        ))
        
        cursor.execute("DELETE FROM challan_items WHERE challan_id = ?", (challan_id,))
        
        for item in challan.items:
            cursor.execute("""
            INSERT INTO challan_items (challan_id, sr_no, description, hsn_sac, quantity)
            VALUES (?, ?, ?, ?, ?)
            """, (challan_id, item.sr_no, item.description, item.hsn_sac, item.quantity))
            
        conn.commit()
        return {"status": "success", "id": challan_id, "challan_no": challan.challan_no}
        
    except sqlite3.IntegrityError as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=f"Challan number already exists or integrity constraint failed: {str(e)}")
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        conn.close()

@app.delete("/api/challans/{challan_id}")
def delete_challan(challan_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM challans WHERE id = ?", (challan_id,))
    if cursor.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="Challan not found")
    conn.commit()
    conn.close()
    return {"status": "success", "message": "Challan deleted successfully"}

# Raw Template File API for Challan
@app.get("/api/templates/challan")
def get_challan_template():
    if getattr(sys, 'frozen', False):
        template_path = os.path.join(sys._MEIPASS, "templates", "challan_template.html")
    else:
        template_path = os.path.join(os.path.dirname(__file__), "templates", "challan_template.html")

    if not os.path.exists(template_path):
        raise HTTPException(status_code=404, detail="Template file not found")
    
    with open(template_path, "r", encoding="utf-8") as f:
        html_content = f.read()
    return {"html": html_content}

# Raw Template File API
@app.get("/api/templates/invoice")
def get_invoice_template():
    if getattr(sys, 'frozen', False):
        template_path = os.path.join(sys._MEIPASS, "templates", "invoice_template.html")
    else:
        template_path = os.path.join(os.path.dirname(__file__), "templates", "invoice_template.html")

    if not os.path.exists(template_path):
        raise HTTPException(status_code=404, detail="Template file not found")
    
    with open(template_path, "r", encoding="utf-8") as f:
        html_content = f.read()
    return {"html": html_content}

# System & Auto-Updater API
@app.get("/api/system/check-update")
async def check_for_updates():
    """Checks GitHub for a newer release tag."""
    headers = {"User-Agent": "ChamundiAccounting-AutoUpdater"}
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(GITHUB_REPO_API, headers=headers)
            if response.status_code == 404:
                return {"update_available": False, "latest_version": CURRENT_VERSION, "message": "No releases published yet"}
            response.raise_for_status()
            release_data = response.json()
            
            latest_version = release_data.get("tag_name")
            
            if latest_version and latest_version != CURRENT_VERSION:
                download_url = None
                for asset in release_data.get("assets", []):
                    if asset["name"].endswith(".exe"):
                        download_url = asset["browser_download_url"]
                        break
                        
                return {
                    "update_available": True,
                    "latest_version": latest_version,
                    "download_url": download_url,
                    "release_notes": release_data.get("body", ""),
                    "current_version": CURRENT_VERSION
                }
                
            return {"update_available": False, "latest_version": CURRENT_VERSION, "current_version": CURRENT_VERSION}
            
        except Exception as e:
            return {"update_available": False, "error": str(e), "current_version": CURRENT_VERSION}

@app.post("/api/system/download-update")
async def download_update(payload: UpdateDownloadSchema):
    """Downloads the new .exe, writes a batch swap script, and restarts the app."""
    download_url = payload.download_url
    if not download_url:
        raise HTTPException(status_code=400, detail="Missing download_url")
        
    try:
        if getattr(sys, 'frozen', False):
            app_dir = os.path.dirname(sys.executable)
            exe_name = os.path.basename(sys.executable)
            exe_path = sys.executable
        else:
            app_dir = os.path.dirname(os.path.dirname(__file__))
            exe_name = "ChamundiAccounting.exe"
            exe_path = os.path.join(app_dir, exe_name)
            
        new_exe_path = os.path.join(app_dir, "ChamundiAccounting_new.exe")
        
        if not getattr(sys, 'frozen', False):
            print(f"[Simulated Update] Would download from: {download_url}")
            print(f"[Simulated Update] Target app directory: {app_dir}")
            print(f"[Simulated Update] Executable path to replace: {exe_path}")
            return {"status": "success", "message": "Simulation: downloaded new version in dev mode"}
            
        headers = {"User-Agent": "ChamundiAccounting-AutoUpdater"}
        async with httpx.AsyncClient() as client:
            async with client.stream("GET", download_url, headers=headers, follow_redirects=True) as response:
                response.raise_for_status()
                with open(new_exe_path, "wb") as f:
                    async for chunk in response.iter_bytes(chunk_size=8192):
                        f.write(chunk)
                        
        bat_path = os.path.join(app_dir, "update_swap.bat")
        
        bat_content = f"""@echo off
echo Waiting for {exe_name} to close...
timeout /t 2 /nobreak > nul
:loop
tasklist /fi "imagename eq {exe_name}" | findstr /i "{exe_name}" > nul
if %errorlevel% equ 0 (
    taskkill /f /im "{exe_name}" > nul 2>&1
    timeout /t 1 /nobreak > nul
    goto loop
)
echo Replacing old executable with new version...
if exist "{exe_path}" del /f /q "{exe_path}"
move /y "{new_exe_path}" "{exe_path}"
echo Restarting {exe_name}...
start "" "{exe_path}"
del "%~f0"
"""
        
        with open(bat_path, "w", encoding="utf-8") as f:
            f.write(bat_content)
            
        try:
            subprocess.Popen([bat_path], creationflags=0x00000008, close_fds=True)
        except Exception as e:
            subprocess.Popen(["cmd.exe", "/c", bat_path], shell=True)
            
        os._exit(0)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Update failed: {str(e)}")

# Serve Frontend SPA Static Files (production build mount)
if getattr(sys, 'frozen', False):
    dist_path = os.path.join(sys._MEIPASS, "dist")
else:
    parent_dir = os.path.dirname(os.path.dirname(__file__))
    dist_path = os.path.join(parent_dir, "dist")
    if not os.path.exists(dist_path) or not os.path.exists(os.path.join(dist_path, "index.html")):
        dist_path = parent_dir

if os.path.exists(os.path.join(dist_path, "index.html")):
    app.mount("/", StaticFiles(directory=dist_path, html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    import webview
    import threading
    import time

    def start_server():
        uvicorn.run(app, host="127.0.0.1", port=8000, log_level="warning")

    # Start FastAPI server in a background daemon thread
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()
    
    # Wait a brief moment for the port to bind
    time.sleep(0.4)
    
    # Create native desktop window wrapping the localhost URL
    webview.create_window(
        title="Chamundi Invoicing & Accounting",
        url="http://127.0.0.1:8000",
        width=1280,
        height=850,
        resizable=True,
        min_size=(1024, 768)
    )
    
    # Start webview loop (blocks until window is closed)
    webview.start()
