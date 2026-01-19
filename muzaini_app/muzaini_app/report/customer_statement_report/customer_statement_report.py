# Copyright (c) 2026, Mohamed AbdElsabour and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.utils import flt, getdate, add_days, cint, formatdate
import datetime


def execute(filters=None):
    if not filters:
        filters = {}

    if not filters.get("from_date"):
        filters["from_date"] = datetime.date.today().replace(day=1)

    if not filters.get("to_date"):
        filters["to_date"] = datetime.date.today()

    if not filters.get("customer"):
        frappe.throw(_("يرجى تحديد العميل"))

    columns = get_columns()

    opening_balance, opening_date, data = get_customer_ledger_entries(filters)

    if opening_date:
        formatted_opening_date = formatdate(opening_date)
    else:
        yesterday = add_days(getdate(), -1)
        formatted_opening_date = formatdate(yesterday)

    report_dict = frappe._dict(
        {
            "opening_balance": flt(opening_balance),
            "opening_date": formatted_opening_date,
        }
    )

    if not data:
        frappe.msgprint(_("لا توجد بيانات لهذا العميل في الفترة المحددة"))
        return columns, data, report_dict

    return columns, data, report_dict


def get_columns():
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
            "label": _("حالة المستند"),
            "fieldtype": "Data",
            "width": 120,
        },
        {
            "fieldname": "payment_type",
            "label": _("نوع السند"),
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


def get_customer_ledger_entries(filters):
    receivable_accounts = get_receivable_accounts(
        filters.get("company"), filters.get("customer")
    )

    if not receivable_accounts:
        frappe.msgprint(_("لم يتم العثور على حسابات مدينة للعميل"))
        return 0, None, []

    opening_balance = 0
    opening_date = add_days(getdate(filters.get("from_date")), -1)

    if not opening_date:
        opening_date = add_days(getdate(), -1)

    user_condition, user_values = get_user_condition(filters)
    cost_center_condition, cost_center_values = get_cost_center_condition(filters)
    warehouse_condition, warehouse_values = get_warehouse_condition(filters)

    for account in receivable_accounts:
        opening_gl_query = """
            SELECT SUM(debit) - SUM(credit) as balance
            FROM `tabGL Entry`
            WHERE account = %s
            AND party_type = 'Customer'
            AND party = %s
            AND company = %s
            AND posting_date <= %s
            AND is_cancelled = 0
        """

        opening_values = [
            account,
            filters.get("customer"),
            filters.get("company"),
            opening_date,
        ]

        if user_condition:
            opening_gl_query += " AND " + user_condition
            opening_values.extend(user_values)

        if cost_center_condition:
            opening_gl_query += " AND " + cost_center_condition
            opening_values.extend(cost_center_values)

        if warehouse_condition:
            opening_gl_query += " AND " + warehouse_condition
            opening_values.extend(warehouse_values)

        opening_gl = frappe.db.sql(opening_gl_query, tuple(opening_values), as_dict=1)

        if opening_gl and opening_gl[0].balance:
            opening_balance += flt(opening_gl[0].balance)

    if opening_balance == 0:
        try:
            current_balance = frappe.db.get_value(
                "Customer", filters.get("customer"), "outstanding_amount"
            )
            if current_balance:
                opening_balance = flt(current_balance)
        except Exception:
            pass

    gl_entries = []
    for account in receivable_accounts:
        gl_query = """
            SELECT
                posting_date,
                voucher_type,
                voucher_no,
                debit,
                credit,
                remarks,
                against,
                is_opening,
                account,
                against_voucher,
                against_voucher_type,
                creation,
                owner,
                CASE
                    WHEN voucher_type = 'Sales Invoice' THEN 
                        (SELECT grand_total FROM `tabSales Invoice` WHERE name = voucher_no)
                    ELSE NULL
                END as invoice_amount,
                CASE
                    WHEN voucher_type = 'Payment Entry' THEN 
                        (SELECT payment_type FROM `tabPayment Entry` WHERE name = voucher_no)
                    ELSE NULL
                END as payment_type,
                CASE
                    WHEN voucher_type = 'Sales Invoice' THEN 
                        (SELECT owner FROM `tabSales Invoice` WHERE name = voucher_no)
                    WHEN voucher_type = 'Payment Entry' THEN 
                        (SELECT owner FROM `tabPayment Entry` WHERE name = voucher_no)
                    WHEN voucher_type = 'Journal Entry' THEN 
                        (SELECT owner FROM `tabJournal Entry` WHERE name = voucher_no)
                    ELSE owner
                END as created_by,
                CASE
                    WHEN voucher_type = 'Sales Invoice' THEN 
                        (SELECT cost_center FROM `tabSales Invoice` WHERE name = voucher_no)
                    WHEN voucher_type = 'Payment Entry' THEN 
                        (SELECT cost_center FROM `tabPayment Entry` WHERE name = voucher_no)
                    WHEN voucher_type = 'Journal Entry' THEN 
                        (SELECT cost_center FROM `tabJournal Entry` WHERE name = voucher_no)
                    ELSE cost_center
                END as cost_center
            FROM
                `tabGL Entry`
            WHERE
                account = %s
                AND party_type = 'Customer'
                AND party = %s
                AND company = %s
                AND posting_date BETWEEN %s AND %s
                AND is_cancelled = 0
        """

        gl_values = [
            account,
            filters.get("customer"),
            filters.get("company"),
            filters.get("from_date"),
            filters.get("to_date"),
        ]

        if user_condition:
            gl_query += " AND " + user_condition
            gl_values.extend(user_values)

        if cost_center_condition:
            gl_query += " AND " + cost_center_condition
            gl_values.extend(cost_center_values)

        if warehouse_condition:
            gl_query += " AND " + warehouse_condition
            gl_values.extend(warehouse_values)

        gl_query += " ORDER BY posting_date, creation"

        entries = frappe.db.sql(gl_query, tuple(gl_values), as_dict=1)
        gl_entries.extend(entries)

    gl_entries.sort(
        key=lambda x: (x.posting_date, x.creation if hasattr(x, "creation") else "")
    )

    data = []
    balance = opening_balance

    invoice_numbers = [
        entry.voucher_no
        for entry in gl_entries
        if entry.voucher_type == "Sales Invoice" and entry.voucher_no
    ]
    invoice_statuses = get_invoice_statuses(invoice_numbers)

    payment_references = get_payment_references()

    payment_entries = [
        entry.voucher_no
        for entry in gl_entries
        if entry.voucher_type == "Payment Entry" and entry.voucher_no
    ]
    payment_types = get_payment_types(payment_entries)

    for entry in gl_entries:
        balance += flt(entry.debit) - flt(entry.credit)

        description = entry.remarks or ""

        if (
            entry.voucher_type == "Payment Entry"
            and entry.voucher_no in payment_references
        ):
            references = payment_references[entry.voucher_no]
            if references:
                invoices = [
                    ref.reference_name
                    for ref in references
                    if ref.reference_doctype == "Sales Invoice"
                ]
                if invoices:
                    description = _("سداد للفواتير: ") + ", ".join(invoices)

        if not description:
            description = entry.against or entry.voucher_no or _("لايوجد وصف")

        invoice_status = ""
        if (
            entry.voucher_type == "Sales Invoice"
            and entry.voucher_no in invoice_statuses
        ):
            invoice_status = invoice_statuses[entry.voucher_no]
        elif entry.voucher_type == "Payment Entry":
            invoice_status = _("سداد")

        payment_type = ""
        if entry.voucher_type == "Payment Entry":
            if hasattr(entry, "payment_type") and entry.payment_type:
                if entry.payment_type == "Receive":
                    payment_type = _("استلام")
                elif entry.payment_type == "Pay":
                    payment_type = _("دفع")
            elif entry.voucher_no in payment_types:
                if payment_types[entry.voucher_no] == "Receive":
                    payment_type = _("استلام")
                elif payment_types[entry.voucher_no] == "Pay":
                    payment_type = _("دفع")

        data.append(
            {
                "posting_date": entry.posting_date,
                "voucher_type": entry.voucher_type,
                "voucher_no": entry.voucher_no,
                "description": description,
                "debit": flt(entry.debit),
                "credit": flt(entry.credit),
                "balance": balance,
                "invoice_status": invoice_status,
                "payment_type": payment_type,
                "invoice_amount": (
                    flt(entry.invoice_amount)
                    if hasattr(entry, "invoice_amount") and entry.invoice_amount
                    else None
                ),
                "created_by": (
                    entry.created_by if hasattr(entry, "created_by") else None
                ),
                "cost_center": (
                    entry.cost_center if hasattr(entry, "cost_center") else None
                ),
            }
        )

    if gl_entries:
        total_debit = sum(flt(entry.debit) for entry in gl_entries)
        total_credit = sum(flt(entry.credit) for entry in gl_entries)

        data.append(
            {
                "posting_date": None,
                "voucher_type": "Total",
                "voucher_no": "",
                "description": _("الإجمالي"),
                "debit": total_debit,
                "credit": total_credit,
                "balance": balance,
                "payment_type": "",
                "invoice_status": "",
                "is_total_row": True,
            }
        )

    data.insert(
        0,
        {
            "posting_date": opening_date,
            "voucher_type": "Opening Balance",
            "voucher_no": "",
            "description": _("الرصيد الافتتاحي"),
            "debit": opening_balance if opening_balance > 0 else 0,
            "credit": abs(opening_balance) if opening_balance < 0 else 0,
            "balance": opening_balance,
            "invoice_status": "",
            "payment_type": "",
            "is_opening_row": True,
        },
    )

    return opening_balance, opening_date, data


def get_receivable_accounts(company, customer):
    accounts = []

    try:
        party_accounts = frappe.get_all(
            "Party Account",
            filters={"parenttype": "Customer", "parent": customer, "company": company},
            fields=["account"],
        )

        if party_accounts:
            accounts.extend([d.account for d in party_accounts])
    except Exception:
        pass

    if not accounts:
        try:
            gl_accounts = frappe.db.sql(
                """
                SELECT DISTINCT account
                FROM `tabGL Entry`
                WHERE party_type = 'Customer'
                AND party = %s
                AND company = %s
                AND is_cancelled = 0
                ORDER BY creation DESC
            """,
                (customer, company),
                as_dict=1,
            )

            if gl_accounts:
                accounts.extend([d.account for d in gl_accounts])
        except Exception:
            pass

    if not accounts:
        try:
            receivable_accounts = frappe.get_all(
                "Account",
                filters={
                    "company": company,
                    "account_type": "Receivable",
                    "is_group": 0,
                },
                fields=["name"],
            )

            if receivable_accounts:
                accounts.extend([d.name for d in receivable_accounts])
        except Exception:
            pass

    return accounts


def get_payment_references():
    references = {}

    payment_refs = frappe.db.sql(
        """
        SELECT parent, reference_doctype, reference_name
        FROM `tabPayment Entry Reference`
        WHERE docstatus = 1
    """,
        as_dict=1,
    )

    for ref in payment_refs:
        if ref.parent not in references:
            references[ref.parent] = []
        references[ref.parent].append(ref)

    return references


def get_payment_types(payment_entries):
    payment_types = {}

    if not payment_entries:
        return payment_types

    payments = frappe.get_all(
        "Payment Entry",
        filters={"name": ["in", payment_entries]},
        fields=["name", "payment_type"],
    )

    for payment in payments:
        payment_types[payment.name] = payment.payment_type

    return payment_types


def get_invoice_statuses(invoice_numbers):
    invoice_statuses = {}

    if not invoice_numbers:
        return invoice_statuses

    invoices = frappe.get_all(
        "Sales Invoice",
        filters={"name": ["in", invoice_numbers]},
        fields=[
            "name",
            "status",
            "is_return",
            "outstanding_amount",
            "grand_total",
            "is_pos",
        ],
    )

    for invoice in invoices:
        status = ""

        if invoice.is_return:
            status = _("مرتجع مبيعات")
        elif invoice.status == "Paid" or (
            invoice.grand_total and invoice.outstanding_amount == 0
        ):
            if invoice.is_pos:
                status = _("فاتورة نقدية")
            else:
                status = _("مسددة بالكامل")
        elif invoice.status == "Unpaid":
            status = _("غير مسددة")
        elif invoice.status == "Partly Paid" and invoice.grand_total:
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


def get_user_condition(filters):
    if not filters.get("users"):
        return "", []

    users = filters.get("users")
    if not isinstance(users, list):
        users = [users]

    if not users:
        return "", []

    placeholders = ", ".join(["%s"] * len(users))
    condition = """(
        CASE
            WHEN voucher_type = 'Sales Invoice' THEN 
                (SELECT owner FROM `tabSales Invoice` WHERE name = voucher_no)
            WHEN voucher_type = 'Payment Entry' THEN 
                (SELECT owner FROM `tabPayment Entry` WHERE name = voucher_no)
            WHEN voucher_type = 'Journal Entry' THEN 
                (SELECT owner FROM `tabJournal Entry` WHERE name = voucher_no)
            ELSE owner
        END IN ({0})
    )""".format(
        placeholders
    )

    return condition, users


def get_cost_center_condition(filters):
    if not filters.get("cost_centers"):
        return "", []

    cost_centers = filters.get("cost_centers")
    if not isinstance(cost_centers, list):
        cost_centers = [cost_centers]

    if not cost_centers:
        return "", []

    placeholders = ", ".join(["%s"] * len(cost_centers))
    condition = """(
        CASE
            WHEN voucher_type = 'Sales Invoice' THEN 
                (SELECT cost_center FROM `tabSales Invoice` WHERE name = voucher_no)
            WHEN voucher_type = 'Payment Entry' THEN 
                (SELECT cost_center FROM `tabPayment Entry` WHERE name = voucher_no)
            WHEN voucher_type = 'Journal Entry' THEN 
                (SELECT cost_center FROM `tabJournal Entry` WHERE name = voucher_no)
            ELSE cost_center
        END IN ({0})
        OR 
        (voucher_type = 'Sales Invoice' AND voucher_no IN 
            (SELECT parent FROM `tabSales Invoice Item` WHERE cost_center IN ({0}))
        )
    )""".format(
        placeholders
    )

    values = cost_centers + cost_centers

    return condition, values


def get_warehouse_condition(filters):
    if not filters.get("warehouses"):
        return "", []

    warehouses = filters.get("warehouses")
    if not isinstance(warehouses, list):
        warehouses = [warehouses]

    if not warehouses:
        return "", []

    placeholders = ", ".join(["%s"] * len(warehouses))
    condition = """(
        (voucher_type = 'Sales Invoice' AND voucher_no IN 
            (SELECT parent FROM `tabSales Invoice Item` WHERE warehouse IN ({0}))
        )
    )""".format(
        placeholders
    )

    return condition, warehouses
