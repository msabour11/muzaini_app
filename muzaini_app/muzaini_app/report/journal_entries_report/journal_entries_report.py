# Copyright (c) 2026, Mohamed AbdElsabour and contributors
# For license information, please see license.txt

#
import frappe
from frappe import _
from frappe.utils import flt, getdate, formatdate
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

    # Get report data
    columns = get_columns()
    data = get_journal_entry_data(filters)

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
            "fieldname": "name",
            "label": _("رقم القيد"),
            "fieldtype": "Link",
            "options": "Journal Entry",
            "width": 140,
        },
        {
            "fieldname": "voucher_type",
            "label": _("نوع القيد"),
            "fieldtype": "Data",
            "width": 120,
        },
        {
            "fieldname": "account",
            "label": _("الحساب"),
            "fieldtype": "Link",
            "options": "Account",
            "width": 180,
        },
        {
            "fieldname": "party_name",
            "label": _("اسم الطرف"),
            "fieldtype": "Data",
            "width": 180,
        },
        {
            "fieldname": "party_type",
            "label": _("نوع الطرف"),
            "fieldtype": "Data",
            "width": 100,
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
            "fieldname": "cost_center",
            "label": _("مركز التكلفة"),
            "fieldtype": "Data",
            "width": 130,
        },
        {
            "fieldname": "reference_type",
            "label": _("نوع المرجع"),
            "fieldtype": "Data",
            "width": 130,
        },
        {
            "fieldname": "reference_name",
            "label": _("رقم المرجع"),
            "fieldtype": "Data",
            "width": 130,
        },
        {
            "fieldname": "user_remark",
            "label": _("الملاحظات"),
            "fieldtype": "Data",
            "width": 180,
        },
        {
            "fieldname": "status",
            "label": _("الحالة"),
            "fieldtype": "Data",
            "width": 100,
        },
    ]


def get_journal_entry_data(filters):
    """Get journal entry data based on filters"""
    conditions = []
    values = {
        "company": filters.get("company"),
        "from_date": filters.get("from_date"),
        "to_date": filters.get("to_date"),
    }

    conditions.append("je.company = %(company)s")
    conditions.append("je.posting_date BETWEEN %(from_date)s AND %(to_date)s")

    # Filter by voucher type if provided
    if filters.get("voucher_type") and filters.get("voucher_type") != "All":
        conditions.append("je.voucher_type = %(voucher_type)s")
        values["voucher_type"] = filters.get("voucher_type")

    # Filter by account if provided
    if filters.get("account"):
        conditions.append("jea.account = %(account)s")
        values["account"] = filters.get("account")

    # Filter by party_type if provided
    if filters.get("party_type") and filters.get("party_type") != "All":
        conditions.append("jea.party_type = %(party_type)s")
        values["party_type"] = filters.get("party_type")

    # Filter by party if provided
    if filters.get("party"):
        conditions.append("jea.party = %(party)s")
        values["party"] = filters.get("party")

    # Filter by cost center if provided
    if filters.get("cost_center"):
        conditions.append("jea.cost_center = %(cost_center)s")
        values["cost_center"] = filters.get("cost_center")

    # Filter by status if provided
    if filters.get("status") and filters.get("status") != "All":
        conditions.append("je.docstatus = %(docstatus)s")
        values["docstatus"] = get_docstatus_value(filters.get("status"))

    # Query to get journal entry data
    journal_entries = frappe.db.sql(
        """
        SELECT 
            je.posting_date,
            je.name,
            je.voucher_type,
            je.user_remark,
            je.docstatus,
            jea.account,
            jea.party_type,
            jea.party,
            jea.debit,
            jea.credit,
            jea.cost_center,
            jea.reference_type,
            jea.reference_name,
            CASE
                WHEN jea.party_type = 'Customer' THEN cust.customer_name
                WHEN jea.party_type = 'Supplier' THEN supp.supplier_name
                WHEN jea.party_type = 'Employee' THEN emp.employee_name
                ELSE jea.party
            END as party_name,
            a.account_name
        FROM
            `tabJournal Entry` je
        JOIN
            `tabJournal Entry Account` jea ON je.name = jea.parent
        LEFT JOIN
            `tabAccount` a ON jea.account = a.name
        LEFT JOIN
            `tabCustomer` cust ON jea.party = cust.name AND jea.party_type = 'Customer'
        LEFT JOIN
            `tabSupplier` supp ON jea.party = supp.name AND jea.party_type = 'Supplier'
        LEFT JOIN
            `tabEmployee` emp ON jea.party = emp.name AND jea.party_type = 'Employee'
        WHERE
            {conditions}
        ORDER BY
            je.posting_date DESC, je.name, jea.idx
    """.format(
            conditions=" AND ".join(conditions)
        ),
        values,
        as_dict=1,
    )

    # Process and format data
    data = []
    entries_by_je = {}

    total_debit = 0
    total_credit = 0

    for row in journal_entries:
        # Calculate totals
        total_debit += flt(row.debit)
        total_credit += flt(row.credit)

        # Get status in Arabic
        status_ar = get_arabic_status(row.docstatus)

        # Get voucher type in Arabic
        voucher_type_ar = get_arabic_voucher_type(row.voucher_type)

        # Create a key for grouping entries by journal entry
        je_key = row.name

        # If this is a new journal entry, initialize its entries list
        if je_key not in entries_by_je:
            entries_by_je[je_key] = []

        # Add this account line to the journal entry
        entry_data = {
            "posting_date": row.posting_date,
            "name": row.name,
            "voucher_type": voucher_type_ar,
            "account": (
                f"{row.account} - {row.account_name}"
                if row.account_name
                else row.account
            ),
            "party_type": _(row.party_type) if row.party_type else "",
            "party": row.party,
            "party_name": row.party_name or row.party or "",
            "debit": flt(row.debit),
            "credit": flt(row.credit),
            "cost_center": row.cost_center or _("غير محدد"),
            "reference_type": _(row.reference_type) if row.reference_type else "",
            "reference_name": row.reference_name or "",
            "user_remark": row.user_remark or "",
            "status": status_ar,
        }

        entries_by_je[je_key].append(entry_data)

    # Now, add each journal entry to the data, with appropriate grouping
    for je_key, entries in entries_by_je.items():
        # Add each line of the journal entry
        for i, entry in enumerate(entries):
            if i == 0:
                # First line shows the journal entry header info
                data.append(entry)
            else:
                # Subsequent lines show only the account and amount details
                # But keep the same journal entry reference
                data.append(
                    {
                        "name": entry["name"],
                        "account": entry["account"],
                        "party_type": entry["party_type"],
                        "party_name": entry["party_name"],
                        "debit": entry["debit"],
                        "credit": entry["credit"],
                        "cost_center": entry["cost_center"],
                        "reference_type": entry["reference_type"],
                        "reference_name": entry["reference_name"],
                    }
                )

        # Add a separator row after each journal entry
        if entries:
            data.append({"name": "", "voucher_type": "---", "is_separator": True})

    # Add summary row
    if data:
        data.append(
            {
                "voucher_type": None,
                "account": _("إجمالي"),
                "debit": flt(total_debit),
                "credit": flt(total_credit),
                "is_total": True,
            }
        )

        # Add net difference row if there's any
        if total_debit != total_credit:
            diff = flt(total_debit - total_credit)
            data.append(
                {
                    "voucher_type": None,
                    "account": _("الفرق"),
                    "debit": flt(diff) if diff > 0 else 0,
                    "credit": flt(abs(diff)) if diff < 0 else 0,
                    "is_diff_total": True,
                }
            )

    return data


def get_arabic_status(docstatus):
    """Convert document status to Arabic"""
    status_map = {0: _("مسودة"), 1: _("معتمد"), 2: _("ملغي")}

    return status_map.get(docstatus, str(docstatus))


def get_docstatus_value(status):
    """Convert status string to docstatus value"""
    status_map = {"Draft": 0, "Submitted": 1, "Cancelled": 2}

    return status_map.get(status, 1)  # Default to Submitted


def get_arabic_voucher_type(voucher_type):
    """Convert voucher types to Arabic"""
    voucher_map = {
        "Journal Entry": _("قيد يومية"),
        "Bank Entry": _("قيد بنكي"),
        "Cash Entry": _("قيد نقدي"),
        "Credit Note": _("إشعار دائن"),
        "Debit Note": _("إشعار مدين"),
        "Contra Entry": _("قيد مقابل"),
        "Excise Entry": _("قيد ضريبي"),
        "Write Off Entry": _("قيد شطب"),
        "Opening Entry": _("قيد افتتاحي"),
        "Depreciation Entry": _("قيد إهلاك"),
    }

    return voucher_map.get(voucher_type, voucher_type)
