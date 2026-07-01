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
import shutil
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from database import get_db_connection, init_db

CURRENT_VERSION = "v1.0.11"
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
    bank_acc_holder: Optional[str] = ""
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
    smtp_host: Optional[str] = "smtp.gmail.com"
    smtp_port: Optional[int] = 587
    smtp_user: Optional[str] = ""
    smtp_password: Optional[str] = ""
    email_to: Optional[str] = ""
    duplicate_invoice: Optional[int] = 0
    triplicate_invoice: Optional[int] = 0

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
        bank_name = ?, bank_acc_no = ?, bank_branch = ?, bank_ifsc = ?, bank_acc_holder = ?,
        cgst_rate = ?, sgst_rate = ?, igst_rate = ?,
        invoice_prefix = ?, invoice_suffix = ?, invoice_padding = ?, next_sequence = ?,
        date_format = ?, phone = ?,
        challan_prefix = ?, challan_suffix = ?, challan_padding = ?, next_challan_sequence = ?,
        smtp_host = ?, smtp_port = ?, smtp_user = ?, smtp_password = ?, email_to = ?,
        duplicate_invoice = ?, triplicate_invoice = ?
    WHERE id = 1
    """, (
        config.company_name, config.address_line1, config.address_line2, config.address_line3, config.address_line4,
        config.gstin, config.pan, config.state_name, config.state_code,
        config.bank_name, config.bank_acc_no, config.bank_branch, config.bank_ifsc, config.bank_acc_holder,
        config.cgst_rate, config.sgst_rate, config.igst_rate,
        config.invoice_prefix, config.invoice_suffix, config.invoice_padding, config.next_sequence,
        config.date_format, config.phone,
        config.challan_prefix, config.challan_suffix, config.challan_padding, config.next_challan_sequence,
        config.smtp_host, config.smtp_port, config.smtp_user, config.smtp_password, config.email_to,
        config.duplicate_invoice, config.triplicate_invoice
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
@app.get("/api/system/version")
def get_version():
    return {"version": CURRENT_VERSION}

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
                    async for chunk in response.aiter_bytes(chunk_size=8192):
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
set _MEIPASS2=
set _MEIPASS=
start "" "{exe_path}"
del "%~f0"
"""
        
        with open(bat_path, "w", encoding="utf-8") as f:
            f.write(bat_content)
            
        try:
            os.startfile(bat_path)
        except AttributeError:
            # Fallback for non-Windows (os.startfile only exists on Windows)
            subprocess.Popen(["cmd.exe", "/c", bat_path], creationflags=0x00000010, close_fds=True)
        except Exception as e:
            subprocess.Popen(["cmd.exe", "/c", bat_path], creationflags=0x00000010, close_fds=True)
            
        os._exit(0)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Update failed: {str(e)}")

# Email Export & Zip Helper
def format_date_py(date_str, fmt):
    if not date_str:
        return ''
    parts = date_str.split('-')
    if len(parts) != 3:
        return date_str
    year, month, day = parts
    months_short = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    try:
        month_idx = int(month) - 1
        mmm = months_short[month_idx]
    except Exception:
        mmm = month

    if fmt == 'DD-MM-YYYY':
        return f"{day}-{month}-{year}"
    elif fmt == 'DD/MM/YYYY':
        return f"{day}/{month}/{year}"
    elif fmt == 'MM/DD/YYYY':
        return f"{month}/{day}/{year}"
    elif fmt == 'DD MMM YYYY':
        return f"{day} {mmm} {year}"
    elif fmt == 'MMM DD, YYYY':
        return f"{mmm} {day}, {year}"
    else:
        return f"{year}-{month}-{day}"

@app.post("/api/system/export-email")
def export_and_email_data():
    conn = get_db_connection()
    config = conn.execute("SELECT * FROM company_config WHERE id = 1").fetchone()
    if not config:
        conn.close()
        raise HTTPException(status_code=404, detail="Company configuration not found")
    
    smtp_host = config["smtp_host"]
    smtp_port = config["smtp_port"]
    smtp_user = config["smtp_user"]
    smtp_password = config["smtp_password"]
    email_to = config["email_to"]
    
    if not smtp_host or not smtp_user or not smtp_password or not email_to:
        conn.close()
        raise HTTPException(status_code=400, detail="SMTP Host, User, Password, and Recipient Email must be configured in Settings")
    
    # Create temp directory inside workspace
    if getattr(sys, 'frozen', False):
        parent_dir = os.path.dirname(sys.executable)
    else:
        parent_dir = os.path.dirname(os.path.dirname(__file__))
        
    temp_dir = os.path.join(parent_dir, "export_temp")
    os.makedirs(temp_dir, exist_ok=True)
    
    try:
        from xhtml2pdf import pisa
        
        # Resolve template paths
        if getattr(sys, 'frozen', False):
            invoice_template_path = os.path.join(sys._MEIPASS, "templates", "invoice_pdf_template.html")
            challan_template_path = os.path.join(sys._MEIPASS, "templates", "challan_pdf_template.html")
            logo_path = os.path.join(sys._MEIPASS, "dist", "logo.png")
        else:
            invoice_template_path = os.path.join(os.path.dirname(__file__), "templates", "invoice_pdf_template.html")
            challan_template_path = os.path.join(os.path.dirname(__file__), "templates", "challan_pdf_template.html")
            logo_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "src", "assets", "Logo.png")
            
        with open(invoice_template_path, "r", encoding="utf-8") as f:
            invoice_template = f.read()
        with open(challan_template_path, "r", encoding="utf-8") as f:
            challan_template = f.read()
            
        # Generate Invoice PDFs
        invoices = conn.execute("SELECT * FROM invoices").fetchall()
        for inv in invoices:
            items = conn.execute("SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY sr_no ASC", (inv["id"],)).fetchall()
            
            items_rows = ""
            total_qty = 0
            for index, item in enumerate(items):
                total_qty += item["quantity"]
                items_rows += f"""
                <tr class="item-row">
                    <td class="col-sr" style="border-right: 1px solid #000; text-align: center;">{index + 1}</td>
                    <td class="col-desc" style="border-right: 1px solid #000;">{item["description"]}</td>
                    <td class="col-hsn" style="border-right: 1px solid #000; text-align: center;">{item["hsn_sac"] or ""}</td>
                    <td class="col-qty" style="border-right: 1px solid #000; text-align: right;">{item["quantity"]}</td>
                    <td class="col-rate" style="border-right: 1px solid #000; text-align: right;">{item["rate"]:.2f}</td>
                    <td class="col-amt" style="text-align: right;">{item["amount"]:.2f}</td>
                </tr>
                """
                
            spacer_rows = ""
            min_rows = 12
            spacer_count = max(0, min_rows - len(items))
            for _ in range(spacer_count):
                spacer_rows += """
                <tr class="spacer-row">
                    <td class="col-sr" style="border-right: 1px solid #000; border-bottom: none;"></td>
                    <td class="col-desc" style="border-right: 1px solid #000; border-bottom: none;"></td>
                    <td class="col-hsn" style="border-right: 1px solid #000; border-bottom: none;"></td>
                    <td class="col-qty" style="border-right: 1px solid #000; border-bottom: none;"></td>
                    <td class="col-rate" style="border-right: 1px solid #000; border-bottom: none;"></td>
                    <td class="col-amt" style="border-bottom: none;"></td>
                </tr>
                """
                
            tax_rows = ""
            if inv["cgst_value"] > 0:
                tax_rows += f"""
                <tr>
                    <td class="col-sr" style="border-right: 1px solid #000;"></td>
                    <td class="col-desc font-bold text-right" style="border-right: 1px solid #000; text-align: right;">CGST @ {inv["cgst_rate"]}%</td>
                    <td class="col-hsn" style="border-right: 1px solid #000;"></td>
                    <td class="col-qty" style="border-right: 1px solid #000;"></td>
                    <td class="col-rate" style="border-right: 1px solid #000;"></td>
                    <td class="col-amt font-bold text-right" style="text-align: right;">{inv["cgst_value"]:.2f}</td>
                </tr>
                <tr>
                    <td class="col-sr" style="border-right: 1px solid #000;"></td>
                    <td class="col-desc font-bold text-right" style="border-right: 1px solid #000; text-align: right;">SGST @ {inv["sgst_rate"]}%</td>
                    <td class="col-hsn" style="border-right: 1px solid #000;"></td>
                    <td class="col-qty" style="border-right: 1px solid #000;"></td>
                    <td class="col-rate" style="border-right: 1px solid #000;"></td>
                    <td class="col-amt font-bold text-right" style="text-align: right;">{inv["sgst_value"]:.2f}</td>
                </tr>
                """
            if inv["igst_value"] > 0:
                tax_rows += f"""
                <tr>
                    <td class="col-sr" style="border-right: 1px solid #000;"></td>
                    <td class="col-desc font-bold text-right" style="border-right: 1px solid #000; text-align: right;">IGST @ {inv["igst_rate"]}%</td>
                    <td class="col-hsn" style="border-right: 1px solid #000;"></td>
                    <td class="col-qty" style="border-right: 1px solid #000;"></td>
                    <td class="col-rate" style="border-right: 1px solid #000;"></td>
                    <td class="col-amt font-bold text-right" style="text-align: right;">{inv["igst_value"]:.2f}</td>
                </tr>
                """
            if inv["round_off"] != 0:
                tax_rows += f"""
                <tr>
                    <td class="col-sr" style="border-right: 1px solid #000;"></td>
                    <td class="col-desc font-bold text-right" style="border-right: 1px solid #000; text-align: right;">Round off</td>
                    <td class="col-hsn" style="border-right: 1px solid #000;"></td>
                    <td class="col-qty" style="border-right: 1px solid #000;"></td>
                    <td class="col-rate" style="border-right: 1px solid #000;"></td>
                    <td class="col-amt font-bold text-right" style="text-align: right;">{inv["round_off"]:.2f}</td>
                </tr>
                """
                
            # Determine copies
            copies = ['Original']
            if config.get("duplicate_invoice") == 1:
                copies.append('Duplicate')
            if config.get("triplicate_invoice") == 1:
                copies.append('Triplicate')

            # Extract body content from template
            body_idx_start = invoice_template.find("<body>")
            body_idx_end = invoice_template.find("</body>")
            if body_idx_start != -1 and body_idx_end != -1:
                html_start = invoice_template[:body_idx_start + 6]
                body_template = invoice_template[body_idx_start + 6:body_idx_end]
                html_end = invoice_template[body_idx_end:]
            else:
                html_start = ""
                body_template = invoice_template
                html_end = ""

            bodies = []
            for i, copy in enumerate(copies):
                copy_label = f" - {copy}" if len(copies) > 1 else ""
                copy_body = body_template \
                    .replace("{{copy_label}}", copy_label) \
                    .replace("{{logo_path}}", logo_path) \
                    .replace("{{company_name}}", config["company_name"] or "") \
                    .replace("{{address_line1}}", config["address_line1"] or "") \
                    .replace("{{address_line2}}", config["address_line2"] or "") \
                    .replace("{{address_line3}}", config["address_line3"] or "") \
                    .replace("{{address_line4}}", config["address_line4"] or "") \
                    .replace("{{company_gstin}}", config["gstin"] or "") \
                    .replace("{{company_state_name}}", config["state_name"] or "") \
                    .replace("{{company_state_code}}", config["state_code"] or "") \
                    .replace("{{company_pan}}", config["pan"] or "") \
                    .replace("{{company_phone}}", config["phone"] or "") \
                    .replace("{{invoice_no}}", inv["invoice_no"]) \
                    .replace("{{date}}", format_date_py(inv["date"], config["date_format"])) \
                    .replace("{{ref_no}}", inv["ref_no"] or "") \
                    .replace("{{ref_date}}", format_date_py(inv["ref_date"], config["date_format"])) \
                    .replace("{{vehicle_no}}", inv["vehicle_no"] or "") \
                    .replace("{{other_ref}}", inv["other_ref"] or "") \
                    .replace("{{terms_delivery}}", inv["terms_delivery"] or "") \
                    .replace("{{customer_name}}", inv["customer_name"] or "") \
                    .replace("{{customer_address}}", inv["customer_address"] or "") \
                    .replace("{{customer_gstin}}", inv["customer_gstin"] or "") \
                    .replace("{{customer_state_name}}", inv["customer_state"] or "") \
                    .replace("{{customer_state_code}}", inv["customer_state_code"] or "") \
                    .replace("{{items_rows}}", items_rows) \
                    .replace("{{spacer_rows}}", spacer_rows) \
                    .replace("{{total_quantity}}", str(total_qty)) \
                    .replace("{{taxable_value}}", f"{inv['taxable_value']:.2f}") \
                    .replace("{{tax_rows}}", tax_rows) \
                    .replace("{{total_value}}", f"{inv['total_value']:.2f}") \
                    .replace("{{total_words}}", inv["total_words"] or "") \
                    .replace("{{bank_name}}", config["bank_name"] or "") \
                    .replace("{{bank_acc_no}}", config["bank_acc_no"] or "") \
                    .replace("{{bank_branch}}", config["bank_branch"] or "") \
                    .replace("{{bank_ifsc}}", config["bank_ifsc"] or "") \
                    .replace("{{bank_acc_holder}}", config["bank_acc_holder"] or "")

                if i < len(copies) - 1:
                    # Inject page-break-after: always to separate pages in single PDF
                    copy_body = copy_body.replace('<div class="invoice-container">', '<div class="invoice-container" style="page-break-after: always;">')

                bodies.append(copy_body)

            html_content = html_start + "\n".join(bodies) + html_end
            
            safe_invoice_no = inv["invoice_no"].replace("/", "_").replace("\\", "_")
            pdf_path = os.path.join(temp_dir, f"Invoice_{safe_invoice_no}.pdf")
            
            with open(pdf_path, "w+b") as result_file:
                pisa.CreatePDF(html_content, dest=result_file)
                
        # Generate Challan PDFs
        challans = conn.execute("SELECT * FROM challans").fetchall()
        for ch in challans:
            ch_items = conn.execute("SELECT * FROM challan_items WHERE challan_id = ? ORDER BY sr_no ASC", (ch["id"],)).fetchall()
            
            ch_items_rows = ""
            total_ch_qty = 0
            for index, item in enumerate(ch_items):
                total_ch_qty += item["quantity"]
                ch_items_rows += f"""
                <tr class="item-row">
                    <td class="col-sr" style="border-right: 1px solid #000; text-align: center;">{index + 1}</td>
                    <td class="col-desc" style="border-right: 1px solid #000;">{item["description"]}</td>
                    <td class="col-hsn" style="border-right: 1px solid #000; text-align: center;">{item["hsn_sac"] or ""}</td>
                    <td class="col-qty" style="text-align: right;">{item["quantity"]}</td>
                </tr>
                """
                
            ch_spacer_rows = ""
            min_rows = 12
            spacer_count = max(0, min_rows - len(ch_items))
            for _ in range(spacer_count):
                ch_spacer_rows += """
                <tr class="spacer-row">
                    <td class="col-sr" style="border-right: 1px solid #000; border-bottom: none;"></td>
                    <td class="col-desc" style="border-right: 1px solid #000; border-bottom: none;"></td>
                    <td class="col-hsn" style="border-right: 1px solid #000; border-bottom: none;"></td>
                    <td class="col-qty" style="border-bottom: none;"></td>
                </tr>
                """
                
            ch_html_content = challan_template \
                .replace("{{logo_path}}", logo_path) \
                .replace("{{company_name}}", config["company_name"] or "") \
                .replace("{{address_line1}}", config["address_line1"] or "") \
                .replace("{{address_line2}}", config["address_line2"] or "") \
                .replace("{{address_line3}}", config["address_line3"] or "") \
                .replace("{{address_line4}}", config["address_line4"] or "") \
                .replace("{{company_gstin}}", config["gstin"] or "") \
                .replace("{{company_state_name}}", config["state_name"] or "") \
                .replace("{{company_state_code}}", config["state_code"] or "") \
                .replace("{{company_pan}}", config["pan"] or "") \
                .replace("{{company_phone}}", config["phone"] or "") \
                .replace("{{challan_no}}", ch["challan_no"]) \
                .replace("{{date}}", format_date_py(ch["date"], config["date_format"])) \
                .replace("{{ref_no}}", ch["ref_no"] or "") \
                .replace("{{ref_date}}", format_date_py(ch["ref_date"], config["date_format"])) \
                .replace("{{vehicle_no}}", ch["vehicle_no"] or "") \
                .replace("{{terms_delivery}}", ch["terms_delivery"] or "") \
                .replace("{{customer_name}}", ch["customer_name"] or "") \
                .replace("{{customer_address}}", ch["customer_address"] or "") \
                .replace("{{customer_gstin}}", ch["customer_gstin"] or "") \
                .replace("{{customer_state_name}}", ch["customer_state"] or "") \
                .replace("{{customer_state_code}}", ch["customer_state_code"] or "") \
                .replace("{{items_rows}}", ch_items_rows) \
                .replace("{{spacer_rows}}", ch_spacer_rows) \
                .replace("{{total_quantity}}", str(total_ch_qty))
            
            safe_challan_no = ch["challan_no"].replace("/", "_").replace("\\", "_")
            pdf_path = os.path.join(temp_dir, f"Challan_{safe_challan_no}.pdf")
            
            with open(pdf_path, "w+b") as result_file:
                pisa.CreatePDF(ch_html_content, dest=result_file)
                
        # Zip up the files
        zip_base_path = os.path.join(parent_dir, "Chamundi_Export")
        zip_file_path = shutil.make_archive(zip_base_path, "zip", temp_dir)
        zip_filename = os.path.basename(zip_file_path)
        
        # Email setup
        msg = MIMEMultipart()
        msg['From'] = smtp_user
        msg['To'] = email_to
        msg['Subject'] = f"{config['company_name']} - Complete Invoice & DC PDF Export"
        
        body = f"Please find attached the complete export of all invoices and delivery challans as PDFs from {config['company_name']}.\n\nTotal Invoices: {len(invoices)}\nTotal Challans: {len(challans)}"
        msg.attach(MIMEText(body, 'plain'))
        
        with open(zip_file_path, "rb") as attachment:
            part = MIMEBase("application", "octet-stream")
            part.set_payload(attachment.read())
            encoders.encode_base64(part)
            part.add_header(
                "Content-Disposition",
                f"attachment; filename= {zip_filename}",
            )
            msg.attach(part)
            
        # Connect and send via SMTP
        server = None
        try:
            if smtp_port == 465:
                server = smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=30)
            else:
                server = smtplib.SMTP(smtp_host, smtp_port, timeout=30)
                server.starttls()
                
            server.login(smtp_user, smtp_password)
            server.sendmail(smtp_user, email_to, msg.as_string())
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Email sending failed: {str(e)}")
        finally:
            if server:
                server.quit()
                
        # Cleanup
        shutil.rmtree(temp_dir, ignore_errors=True)
        if os.path.exists(zip_file_path):
            os.remove(zip_file_path)
            
        conn.close()
        return {"status": "success", "message": "All invoices and delivery challans exported as PDF and emailed successfully."}
        
    except Exception as e:
        shutil.rmtree(temp_dir, ignore_errors=True)
        zip_file_to_check = os.path.join(parent_dir, "Chamundi_Export.zip")
        if os.path.exists(zip_file_to_check):
            os.remove(zip_file_to_check)
        conn.close()
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")

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
