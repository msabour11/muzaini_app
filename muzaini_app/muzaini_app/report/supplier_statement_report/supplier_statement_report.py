# Copyright (c) 2026, Mohamed AbdElsabour and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.utils import flt, getdate, add_days, cint
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

    # Ensure supplier is specified
    if not filters.get("supplier"):
        frappe.throw(_("يرجى تحديد المورد"))

    # Always include opening balance for consistency
    filters["include_opening_balance"] = 1

    # Get report data
    columns = get_columns()
    data = get_statement_data(filters)

    return columns, data


def get_columns():
    """Define the columns for the report"""
    return [
        {
            "fieldname": "posting_date",
            "label": _("التاريخ"),
            "fieldtype": "Date",
            "width": 110,
        },
        {
            "fieldname": "voucher_no",
            "label": _("رقم المستند"),
            "fieldtype": "Dynamic Link",
            "options": "voucher_type",
            "width": 150,
        },
        {
            "fieldname": "voucher_type",
            "label": _("نوع المستند"),
            "fieldtype": "Data",
            "width": 150,
        },
        {
            "fieldname": "description",
            "label": _("البيان"),
            "fieldtype": "Data",
            "width": 250,
        },
        {
            "fieldname": "invoice_status",
            "label": _("حالة الفاتورة"),
            "fieldtype": "Data",
            "width": 120,
        },
        {
            "fieldname": "debit",
            "label": _("مدين"),
            "fieldtype": "Currency",
            "width": 120,
        },
        {
            "fieldname": "credit",
            "label": _("دائن"),
            "fieldtype": "Currency",
            "width": 120,
        },
        {
            "fieldname": "balance",
            "label": _("الرصيد"),
            "fieldtype": "Currency",
            "width": 120,
        },
        {
            "fieldname": "invoice_amount",
            "label": _("قيمة الفاتورة"),
            "fieldtype": "Currency",
            "width": 120,
        },
    ]


def get_statement_data(filters):
    """Generate the statement data based on GL entries"""
    # Get GL entries for the supplier within the date range
    gl_entries = get_gl_entries(filters)

    # Calculate opening balance before the start date
    opening_balance = get_opening_balance(filters)

    # Create data list for the report
    data = []

    # Add opening balance as the first row
    data.append(
        {
            "posting_date": add_days(getdate(filters.get("from_date")), -1),
            "voucher_type": "Opening Balance",
            "description": _("الرصيد الافتتاحي"),
            "debit": flt(opening_balance) if opening_balance > 0 else 0,
            "credit": abs(flt(opening_balance)) if opening_balance < 0 else 0,
            "balance": flt(opening_balance),
            "invoice_status": "",
        }
    )

    # Track running balance
    balance = flt(opening_balance)

    # Get invoice statuses for all relevant invoices
    invoice_statuses = get_invoice_statuses(gl_entries)

    # Process and add each GL entry
    for entry in gl_entries:
        # Update the running balance
        if entry.debit:
            balance = flt(balance) + flt(entry.debit)
        if entry.credit:
            balance = flt(balance) - flt(entry.credit)

        # Prepare transaction description
        description = entry.remarks or entry.against or ""

        # Get invoice status if available
        invoice_status = ""
        if (
            entry.voucher_type == "Purchase Invoice"
            and entry.voucher_no in invoice_statuses
        ):
            invoice_status = invoice_statuses[entry.voucher_no]

        # Add the transaction to the data including invoice amount and status
        data.append(
            {
                "posting_date": entry.posting_date,
                "voucher_type": entry.voucher_type,
                "voucher_no": entry.voucher_no,
                "description": description,
                "debit": flt(entry.debit),
                "credit": flt(entry.credit),
                "balance": flt(balance),
                "against": entry.against,
                "invoice_amount": (
                    flt(entry.invoice_amount)
                    if hasattr(entry, "invoice_amount") and entry.invoice_amount
                    else None
                ),
                "invoice_status": invoice_status,
            }
        )

    # Add total row
    total_debit = sum(
        row.get("debit", 0)
        for row in data
        if row.get("voucher_type") != "Opening Balance"
    )
    total_credit = sum(
        row.get("credit", 0)
        for row in data
        if row.get("voucher_type") != "Opening Balance"
    )

    data.append(
        {
            "posting_date": None,
            "voucher_type": None,
            "voucher_no": None,
            "description": _("الإجمالي"),
            "debit": flt(total_debit),
            "credit": flt(total_credit),
            "balance": flt(balance),
            "is_total_row": True,
            "invoice_status": "",
        }
    )

    return data


def get_invoice_statuses(gl_entries):
    """Get the payment status for all purchase invoices in the GL entries"""
    invoice_statuses = {}

    # Get all unique purchase invoice numbers
    invoice_numbers = list(
        set(
            [
                entry.voucher_no
                for entry in gl_entries
                if entry.voucher_type == "Purchase Invoice" and entry.voucher_no
            ]
        )
    )

    if not invoice_numbers:
        return invoice_statuses

    # Fetch invoice status directly from the database
    invoices = frappe.get_all(
        "Purchase Invoice",
        filters={"name": ["in", invoice_numbers]},
        fields=["name", "status", "is_return", "outstanding_amount", "grand_total"],
    )

    for invoice in invoices:
        status = ""

        if invoice.is_return:
            status = _("مرتجع مشتريات")
        elif invoice.status == "Paid" or invoice.outstanding_amount == 0:
            status = _("مسددة بالكامل")
        elif invoice.status == "Unpaid":
            status = _("غير مسددة")
        elif invoice.status == "Partly Paid":
            outstanding_percent = (
                invoice.outstanding_amount / invoice.grand_total
            ) * 100
            status = _("مسددة جزئياً ({0}%)").format(round(100 - outstanding_percent))
        elif invoice.status == "Overdue":
            status = _("متأخرة السداد")
        elif invoice.status == "Cancelled":
            status = _("ملغية")
        else:
            status = _(invoice.status)

        invoice_statuses[invoice.name] = status

    return invoice_statuses


def get_gl_entries(filters):
    """Fetch GL entries based on filters"""
    # Build query conditions
    conditions = []
    values = {
        "company": filters.get("company"),
        "from_date": filters.get("from_date"),
        "to_date": filters.get("to_date"),
        "supplier": filters.get("supplier"),
    }

    conditions.append("gle.company = %(company)s")
    conditions.append("gle.posting_date BETWEEN %(from_date)s AND %(to_date)s")
    conditions.append("gle.party_type = 'Supplier'")
    conditions.append("gle.party = %(supplier)s")

    # Check if cancelled documents should be included
    if not cint(filters.get("include_cancelled")):
        conditions.append("gle.is_cancelled = 0")

    # Retrieve GL entries directly from the ledger
    # Here we join with account table to ensure we're looking at correct accounts
    # Also retrieve grand_total for invoices
    gl_entries = frappe.db.sql(
        """
        SELECT
            gle.posting_date, 
            gle.voucher_type, 
            gle.voucher_no, 
            SUM(gle.debit) as debit, 
            SUM(gle.credit) as credit,
            gle.against, 
            gle.remarks, 
            gle.against_voucher, 
            gle.creation,
            acc.account_type,
            CASE 
                WHEN gle.voucher_type = 'Purchase Invoice' THEN (SELECT grand_total FROM `tabPurchase Invoice` WHERE name = gle.voucher_no)
                WHEN gle.voucher_type = 'Sales Invoice' THEN (SELECT grand_total FROM `tabSales Invoice` WHERE name = gle.voucher_no)
                ELSE NULL
            END as invoice_amount
        FROM
            `tabGL Entry` gle
        LEFT JOIN
            `tabAccount` acc ON gle.account = acc.name
        WHERE
            {conditions}
        GROUP BY
            gle.voucher_type, gle.voucher_no, gle.against, gle.remarks
        ORDER BY
            gle.posting_date, gle.creation
    """.format(
            conditions=" AND ".join(conditions)
        ),
        values,
        as_dict=1,
    )

    return gl_entries


def get_opening_balance(filters):
    """Calculate opening balance before the from_date"""
    opening_balance = 0
    values = {
        "company": filters.get("company"),
        "from_date": filters.get("from_date"),
        "supplier": filters.get("supplier"),
    }

    # Direct query to calculate opening balance from GL entries
    query = """
        SELECT
            SUM(debit) - SUM(credit) as opening_balance
        FROM
            `tabGL Entry` gle
        WHERE
            gle.company = %(company)s
            AND gle.posting_date < %(from_date)s
            AND gle.party_type = 'Supplier'
            AND gle.party = %(supplier)s
            AND gle.is_cancelled = 0
    """

    opening_balance_data = frappe.db.sql(query, values, as_dict=1)

    if opening_balance_data and opening_balance_data[0].opening_balance is not None:
        opening_balance = flt(opening_balance_data[0].opening_balance)

    # Double-check against supplier ledger if available
    try:
        from erpnext.accounts.party import get_party_account_balance

        supplier_balance = get_party_account_balance(
            filters.get("supplier"),
            "Supplier",
            filters.get("company"),
            filters.get("from_date"),
        )

        if supplier_balance:
            # Use the more accurate supplier ledger balance if available
            opening_balance = supplier_balance[0][2]
    except:
        # Continue with the calculated opening balance if the above fails
        pass

    return opening_balance
