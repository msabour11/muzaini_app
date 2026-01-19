# Copyright (c) 2026, Mohamed AbdElsabour and contributors
# For license information, please see license.txt


import frappe
from frappe import _
from frappe.utils import flt, getdate, cint, get_datetime
import datetime


def execute(filters=None):
    """Main execution function for the report"""
    if not filters:
        filters = {}

    # Set default date range if not provided
    if not filters.get("from_date"):
        filters["from_date"] = datetime.date.today().replace(day=1)

    if not filters.get("to_date"):
        filters["to_date"] = datetime.date.today()

    # Mode of payment is required
    if not filters.get("mode_of_payment"):
        frappe.throw(_("طريقة الدفع مطلوبة"))

    # Get report data
    columns = get_columns()
    data = get_cash_account_data(filters)

    return columns, data


def get_columns():
    """Define the columns for the report"""
    return [
        {
            "fieldname": "posting_date",
            "label": _("التاريخ"),
            "fieldtype": "Date",
            "width": 100,
        },
        {
            "fieldname": "voucher_type",
            "label": _("نوع المستند"),
            "fieldtype": "Data",
            "width": 130,
        },
        {
            "fieldname": "voucher_no",
            "label": _("رقم المستند"),
            "fieldtype": "Dynamic Link",
            "options": "voucher_type",
            "width": 140,
        },
        {
            "fieldname": "description",
            "label": _("البيان"),
            "fieldtype": "Data",
            "width": 250,
        },
        {
            "fieldname": "debit_amount",
            "label": _("مدين"),
            "fieldtype": "Currency",
            "width": 120,
        },
        {
            "fieldname": "credit_amount",
            "label": _("دائن"),
            "fieldtype": "Currency",
            "width": 120,
        },
        {
            "fieldname": "running_balance",
            "label": _("الرصيد"),
            "fieldtype": "Currency",
            "width": 120,
        },
        {
            "fieldname": "created_by",
            "label": _("المستخدم"),
            "fieldtype": "Link",
            "options": "User",
            "width": 120,
        },
        {
            "fieldname": "cost_center",
            "label": _("مركز التكلفة"),
            "fieldtype": "Data",
            "width": 130,
            "hidden": 1,
        },
    ]


def get_mode_of_payment_account(mode_of_payment, company):
    """Get account associated with the mode of payment for the company"""
    account = frappe.db.get_value(
        "Mode of Payment Account",
        {"parent": mode_of_payment, "company": company},
        "default_account",
    )

    return account


def get_opening_balance(filters):
    """Calculate opening balance for the account up to from_date"""
    # Get balance for the account at the start of the period
    opening_balance = 0

    # Ensure we have a payment account
    payment_account = filters.get("payment_account")
    if not payment_account:
        return 0

    # Get all GL entries up to the from_date
    gl_entries = frappe.db.sql(
        """
        SELECT
            SUM(debit) as total_debit,
            SUM(credit) as total_credit
        FROM
            `tabGL Entry`
        WHERE
            account = %s
            AND company = %s
            AND posting_date < %s
            AND is_cancelled = 0
            AND docstatus = 1
    """,
        (payment_account, filters.get("company"), filters.get("from_date")),
        as_dict=1,
    )

    if gl_entries and gl_entries[0]:
        opening_balance = flt(gl_entries[0].total_debit) - flt(
            gl_entries[0].total_credit
        )

    return opening_balance


def get_transaction_description(entry):
    """Generate meaningful description based on transaction type"""
    description = entry.remarks or ""

    # Try to get more meaningful descriptions based on transaction type
    if entry.voucher_type == "Sales Invoice":
        # For sales invoices
        sinv = frappe.db.get_value(
            "Sales Invoice",
            entry.voucher_no,
            ["status", "remarks", "customer_name"],
            as_dict=1,
        )
        if sinv:
            desc_parts = []
            if sinv.customer_name:
                desc_parts.append(_("العميل: ") + sinv.customer_name)
            if sinv.remarks:
                desc_parts.append(sinv.remarks)
            if desc_parts:
                description = " - ".join(desc_parts)

    elif entry.voucher_type == "Purchase Invoice":
        # For purchase invoices
        pinv = frappe.db.get_value(
            "Purchase Invoice",
            entry.voucher_no,
            ["status", "remarks", "supplier_name"],
            as_dict=1,
        )
        if pinv:
            desc_parts = []
            if pinv.supplier_name:
                desc_parts.append(_("المورد: ") + pinv.supplier_name)
            if pinv.remarks:
                desc_parts.append(pinv.remarks)
            if desc_parts:
                description = " - ".join(desc_parts)

    elif entry.voucher_type == "Payment Entry":
        # For payment entries
        pe = frappe.db.get_value(
            "Payment Entry",
            entry.voucher_no,
            ["payment_type", "remarks", "party_type", "party_name"],
            as_dict=1,
        )
        if pe:
            desc_parts = []
            if pe.party_type and pe.party_name:
                desc_parts.append(f"{_(pe.party_type)}: {pe.party_name}")
            if pe.remarks:
                desc_parts.append(pe.remarks)
            if desc_parts:
                description = " - ".join(desc_parts)

    elif entry.voucher_type == "Journal Entry":
        # For journal entries
        je = frappe.db.get_value(
            "Journal Entry",
            entry.voucher_no,
            ["voucher_type", "user_remark"],
            as_dict=1,
        )
        if je:
            je_type = ""
            if je.voucher_type:
                je_type = _(je.voucher_type)

            desc_parts = []
            if je_type:
                desc_parts.append(je_type)
            if je.user_remark:
                desc_parts.append(je.user_remark)
            if desc_parts:
                description = " - ".join(desc_parts)

    return description


def get_voucher_type_display(voucher_type, voucher_no):
    """Get the display name for voucher type, with special handling for Payment Entries"""
    if voucher_type == "Payment Entry":
        payment_type = frappe.db.get_value("Payment Entry", voucher_no, "payment_type")
        if payment_type == "Receive":
            return _("سند قبض")
        elif payment_type == "Pay":
            return _("سند صرف")
        elif payment_type == "Internal Transfer":
            return _("سند تحويل داخلي")
        else:
            return _("سند دفع")
    elif voucher_type == "Sales Invoice":
        return _("فاتورة مبيعات")
    elif voucher_type == "Purchase Invoice":
        return _("فاتورة مشتريات")
    elif voucher_type == "Journal Entry":
        return _("قيد محاسبي")
    else:
        return _(voucher_type)


def get_document_status(voucher_type, voucher_no):
    """Get the status of a document"""
    status = ""

    if voucher_type == "Sales Invoice":
        status_val = frappe.db.get_value(
            "Sales Invoice", voucher_no, ["status", "is_return"]
        )
        if status_val:
            if status_val[1]:  # is_return
                status = _("مرتجع مبيعات")
            else:
                status = get_arabic_status(status_val[0])

    elif voucher_type == "Purchase Invoice":
        status_val = frappe.db.get_value(
            "Purchase Invoice", voucher_no, ["status", "is_return"]
        )
        if status_val:
            if status_val[1]:  # is_return
                status = _("مرتجع مشتريات")
            else:
                status = get_arabic_status(status_val[0])

    elif voucher_type == "Payment Entry":
        status_val = frappe.db.get_value("Payment Entry", voucher_no, "status")
        if status_val:
            status = get_arabic_status(status_val)

    elif voucher_type == "Journal Entry":
        status = _("مقدم")  # Submitted by default

    return status


def get_arabic_status(status):
    """Convert document status to Arabic"""
    if not status:
        return ""

    # Common status mappings
    status_map = {
        "Draft": _("مسودة"),
        "Submitted": _("مقدم"),
        "Paid": _("مدفوع"),
        "Unpaid": _("غير مسدد"),
        "Partly Paid": _("مسدد جزئياً"),
        "Overdue": _("متأخر السداد"),
        "Cancelled": _("ملغي"),
        "Credit Note Issued": _("إشعار دائن مصدر"),
        "Return": _("مرتجع"),
        "Debit Note Issued": _("إشعار مدين مصدر"),
        "Internal Transfer": _("تحويل داخلي"),
    }

    return status_map.get(status, status)


def get_cash_account_data(filters):
    """Get all transactions related to the specified mode of payment"""
    # First get the account linked to mode of payment for the specified company
    payment_account = get_mode_of_payment_account(
        filters.get("mode_of_payment"), filters.get("company")
    )

    if not payment_account:
        frappe.throw(_("لم يتم العثور على حساب مرتبط بطريقة الدفع لهذه الشركة."))

    # Store the payment account for reference
    filters["payment_account"] = payment_account

    transactions = []

    # Get the opening balance
    opening_balance = get_opening_balance(filters)

    # Get all conditions for filters
    conditions = []
    values = {
        "account": payment_account,
        "company": filters.get("company"),
        "from_date": filters.get("from_date"),
        "to_date": filters.get("to_date"),
        "docstatus": 1,  # Only posted/submitted transactions
    }

    # Common conditions
    conditions.append("gl.account = %(account)s")
    conditions.append("gl.company = %(company)s")
    conditions.append("gl.posting_date BETWEEN %(from_date)s AND %(to_date)s")
    conditions.append("gl.is_cancelled = 0")
    conditions.append("gl.docstatus = %(docstatus)s")

    # Cost center filter
    if filters.get("cost_center"):
        conditions.append("gl.cost_center = %(cost_center)s")
        values["cost_center"] = filters.get("cost_center")

    # User filter
    if filters.get("user"):
        conditions.append("gl.owner = %(user)s")
        values["user"] = filters.get("user")

    # Query to get all transactions
    gl_entries = frappe.db.sql(
        """
        SELECT
            gl.posting_date,
            gl.voucher_type,
            gl.voucher_no,
            gl.against,
            gl.debit,
            gl.credit,
            gl.remarks,
            gl.cost_center,
            gl.owner as created_by
        FROM
            `tabGL Entry` gl
        WHERE
            {conditions}
        ORDER BY
            gl.posting_date, gl.creation
    """.format(
            conditions=" AND ".join(conditions)
        ),
        values,
        as_dict=1,
    )

    # Add opening balance row if we have it
    running_balance = opening_balance
    if opening_balance != 0:
        debit_amount = opening_balance if opening_balance > 0 else 0
        credit_amount = abs(opening_balance) if opening_balance < 0 else 0

        # Add opening balance amounts to totals
        total_debit = debit_amount
        total_credit = credit_amount

        transactions.append(
            {
                "posting_date": filters.get("from_date"),
                "voucher_type": "",
                "voucher_no": "",
                "description": _("رصيد افتتاحي"),
                "debit_amount": debit_amount,
                "credit_amount": credit_amount,
                "running_balance": opening_balance,
                "created_by": "",
            }
        )
    else:
        total_debit = 0
        total_credit = 0

    # Process GL entries
    for entry in gl_entries:
        # Get description based on transaction type
        description = get_transaction_description(entry)

        # Calculate debit and credit amounts
        debit_amount = flt(entry.debit)
        credit_amount = flt(entry.credit)

        # Update running balance
        running_balance += debit_amount - credit_amount

        # Update totals
        total_debit += debit_amount
        total_credit += credit_amount

        # Get voucher type display name
        voucher_type_display = get_voucher_type_display(
            entry.voucher_type, entry.voucher_no
        )

        # Add to transactions list
        transactions.append(
            {
                "posting_date": entry.posting_date,
                "voucher_type": voucher_type_display,
                "voucher_no": entry.voucher_no,
                "description": description,
                "debit_amount": debit_amount,
                "credit_amount": credit_amount,
                "running_balance": running_balance,
                "created_by": entry.created_by,
                "cost_center": entry.cost_center,
            }
        )

    # Add total row
    transactions.append(
        {
            "posting_date": "",
            "voucher_type": None,
            "voucher_no": None,
            "description": _("الإجمالي"),
            "debit_amount": total_debit,
            "credit_amount": total_credit,
            "running_balance": running_balance,
            "created_by": "",
            "is_total_row": True,
        }
    )

    return transactions
