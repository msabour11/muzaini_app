# Copyright (c) 2026, Mohamed AbdElsabour and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.utils import flt, getdate, formatdate
import datetime


def execute(filters=None):
    if not filters:
        filters = {}

    if not filters.get("from_date"):
        filters["from_date"] = datetime.date.today().replace(day=1)

    if not filters.get("to_date"):
        filters["to_date"] = datetime.date.today()

    columns = get_columns()
    data = get_payment_data(filters)

    return columns, data


def get_columns():
    return [
        {
            "fieldname": "posting_date",
            "label": _("التاريخ"),
            "fieldtype": "Date",
            "width": 100,
        },
        {
            "fieldname": "payment_type",
            "label": _("نوع السند"),
            "fieldtype": "Data",
            "width": 120,
        },
        {
            "fieldname": "name",
            "label": _("رقم السند"),
            "fieldtype": "Link",
            "options": "Payment Entry",
            "width": 140,
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
            "fieldname": "paid_amount",
            "label": _("المبلغ"),
            "fieldtype": "Currency",
            "width": 120,
        },
        {
            "fieldname": "account",
            "label": _("الحساب"),
            "fieldtype": "Data",
            "width": 160,
        },
        {
            "fieldname": "mode_of_payment",
            "label": _("طريقة الدفع"),
            "fieldtype": "Data",
            "width": 130,
        },
        {
            "fieldname": "reference_no",
            "label": _("الرقم المرجعي"),
            "fieldtype": "Data",
            "width": 130,
        },
        {
            "fieldname": "cost_center",
            "label": _("مركز التكلفة"),
            "fieldtype": "Data",
            "width": 130,
        },
        {
            "fieldname": "status",
            "label": _("الحالة"),
            "fieldtype": "Data",
            "width": 100,
        },
    ]


def get_payment_data(filters):
    conditions = []
    values = {
        "company": filters.get("company"),
        "from_date": filters.get("from_date"),
        "to_date": filters.get("to_date"),
    }

    conditions.append("pe.company = %(company)s")
    conditions.append("pe.posting_date BETWEEN %(from_date)s AND %(to_date)s")

    if filters.get("payment_type") and filters.get("payment_type") != "All":
        conditions.append("pe.payment_type = %(payment_type)s")
        values["payment_type"] = filters.get("payment_type")

    if filters.get("party_type") and filters.get("party_type") != "All":
        conditions.append("pe.party_type = %(party_type)s")
        values["party_type"] = filters.get("party_type")

    if filters.get("party"):
        conditions.append("pe.party = %(party)s")
        values["party"] = filters.get("party")

    if filters.get("mode_of_payment"):
        conditions.append("pe.mode_of_payment = %(mode_of_payment)s")
        values["mode_of_payment"] = filters.get("mode_of_payment")

    if filters.get("account"):
        conditions.append("pe.paid_to = %(account)s OR pe.paid_from = %(account)s")
        values["account"] = filters.get("account")

    if filters.get("cost_center"):
        conditions.append("pe.cost_center = %(cost_center)s")
        values["cost_center"] = filters.get("cost_center")

    if filters.get("status") and filters.get("status") != "All":
        conditions.append("pe.status = %(status)s")
        values["status"] = filters.get("status")

    payment_data = frappe.db.sql(
        """
        SELECT 
            pe.posting_date,
            pe.payment_type,
            pe.name,
            pe.party_type,
            pe.party,
            pe.paid_amount,
            pe.received_amount,
            CASE 
                WHEN pe.payment_type = 'Receive' THEN pe.paid_to
                WHEN pe.payment_type = 'Pay' THEN pe.paid_from
                ELSE CONCAT(pe.paid_from, ' → ', pe.paid_to)
            END as account,
            pe.mode_of_payment,
            pe.reference_no,
            pe.reference_date,
            pe.cost_center,
            pe.status,
            CASE
                WHEN pe.party_type = 'Customer' THEN cust.customer_name
                WHEN pe.party_type = 'Supplier' THEN supp.supplier_name
                ELSE pe.party
            END as party_name
        FROM
            `tabPayment Entry` pe
        LEFT JOIN
            `tabCustomer` cust ON pe.party = cust.name AND pe.party_type = 'Customer'
        LEFT JOIN
            `tabSupplier` supp ON pe.party = supp.name AND pe.party_type = 'Supplier'
        WHERE
            {conditions}
        GROUP BY
            pe.name
        ORDER BY
            pe.posting_date DESC, pe.name
    """.format(
            conditions=" AND ".join(conditions)
        ),
        values,
        as_dict=1,
    )

    data = []
    total_receipts = 0
    total_payments = 0

    for row in payment_data:
        if row.payment_type == "Receive":
            payment_type_ar = _("سند قبض")
            amount = row.received_amount
            total_receipts += flt(amount)
        elif row.payment_type == "Pay":
            payment_type_ar = _("سند صرف")
            amount = row.paid_amount
            total_payments += flt(amount)
        else:
            payment_type_ar = _("تحويل داخلي")
            amount = row.paid_amount

        status_ar = get_arabic_status(row.status)

        data.append(
            {
                "posting_date": row.posting_date,
                "payment_type": payment_type_ar,
                "name": row.name,
                "party_type": _(row.party_type) if row.party_type else "",
                "party": row.party,
                "party_name": row.party_name or row.party,
                "paid_amount": flt(amount),
                "account": row.account,
                "mode_of_payment": row.mode_of_payment,
                "reference_no": row.reference_no,
                "reference_date": row.reference_date,
                "cost_center": row.cost_center,
                "status": status_ar,
            }
        )

    if data:
        data.append(
            {
                "payment_type": None,
                "name": None,
                "party_name": _("إجمالي المقبوضات"),
                "paid_amount": flt(total_receipts),
                "is_receipt_total": True,
            }
        )

        data.append(
            {
                "payment_type": None,
                "name": None,
                "party_name": _("إجمالي المدفوعات"),
                "paid_amount": flt(total_payments),
                "is_payment_total": True,
            }
        )

        data.append(
            {
                "payment_type": None,
                "name": None,
                "party_name": _("صافي الحركة"),
                "paid_amount": flt(total_receipts - total_payments),
                "is_net_total": True,
            }
        )

    return data


def get_arabic_status(status):
    status_map = {
        "Draft": _("مسودة"),
        "Submitted": _("مقدم"),
        "Cancelled": _("ملغي"),
        "Paid": _("مدفوع"),
        "Unpaid": _("غير مدفوع"),
        "Partly Paid": _("مدفوع جزئياً"),
        "Overdue": _("متأخر"),
        "Return": _("مرتجع"),
    }

    return status_map.get(status, status)
