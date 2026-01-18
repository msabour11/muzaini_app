# Copyright (c) 2026, Mohamed AbdElsabour and contributors
# For license information, please see license.txt


import frappe
from frappe import _
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

    # Set default time range if not provided
    if not filters.get("from_time"):
        filters["from_time"] = "00:00:00"

    if not filters.get("to_time"):
        filters["to_time"] = "23:59:59"

    # Get report data
    columns = get_columns()
    data = get_sales_data(filters)

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
            "fieldname": "posting_time",
            "label": _("الوقت"),
            "fieldtype": "Time",
            "width": 80,
        },
        {
            "fieldname": "voucher_type",
            "label": _("نوع المستند"),
            "fieldtype": "Data",
            "width": 120,
        },
        {
            "fieldname": "voucher_no",
            "label": _("رقم المستند"),
            "fieldtype": "Link",
            "options": "Sales Invoice",
            "width": 140,
        },
        {
            "fieldname": "return_against",
            "label": _("مرتجع مقابل"),
            "fieldtype": "Link",
            "options": "Sales Invoice",
            "width": 140,
        },
        {
            "fieldname": "customer_name",
            "label": _("العميل"),
            "fieldtype": "Data",
            "width": 180,
        },
        {
            "fieldname": "invoice_status",
            "label": _("حالة الفاتورة"),
            "fieldtype": "Data",
            "width": 120,
        },
        {
            "fieldname": "tax_amount",
            "label": _("الضريبة"),
            "fieldtype": "Currency",
            "width": 120,
        },
        {
            "fieldname": "grand_total",
            "label": _("المبلغ"),
            "fieldtype": "Currency",
            "width": 120,
        },
        {
            "fieldname": "pos_profile",
            "label": _("نقطة البيع"),
            "fieldtype": "Data",
            "width": 120,
        },
        {
            "fieldname": "owner",
            "label": _("المستخدم"),
            "fieldtype": "Data",
            "width": 120,
        },
        {
            "fieldname": "warehouse",
            "label": _("المستودع"),
            "fieldtype": "Data",
            "width": 120,
        },
        {
            "fieldname": "cost_center",
            "label": _("مركز التكلفة"),
            "fieldtype": "Data",
            "width": 140,
        },
        {
            "fieldname": "mode_of_payment",
            "label": _("طريقة الدفع"),
            "fieldtype": "Data",
            "width": 130,
        },
        {
            "fieldname": "credit_return_status",
            "label": _("حالة مرتجع الآجل"),
            "fieldtype": "Data",
            "width": 140,
        },
    ]


def get_sales_data(filters):
    """Get sales data based on filters"""
    conditions = []
    values = {
        "company": filters.get("company"),
        "from_date": filters.get("from_date"),
        "to_date": filters.get("to_date"),
    }

    conditions.append("si.company = %(company)s")
    conditions.append("si.posting_date BETWEEN %(from_date)s AND %(to_date)s")

    # Filter explicitly by docstatus and status to ensure only submitted
    # invoices are shown, not drafts or cancelled ones
    conditions.append("si.docstatus = 1")  # Only submitted/confirmed invoices
    conditions.append("si.status NOT IN ('Draft', 'Cancelled')")  # Additional guarantee

    # Add time filter conditions
    if filters.get("from_time") and filters.get("to_time"):
        conditions.append(
            """
            CONCAT(si.posting_date, ' ', si.posting_time) BETWEEN 
            CONCAT(%(from_date)s, ' ', %(from_time)s) AND 
            CONCAT(%(to_date)s, ' ', %(to_time)s)
        """
        )
        values["from_time"] = filters.get("from_time")
        values["to_time"] = filters.get("to_time")

    # Filter by customer if provided
    if filters.get("customer"):
        conditions.append("si.customer = %(customer)s")
        values["customer"] = filters.get("customer")

    # Filter by mode of payment if provided
    if filters.get("mode_of_payment"):
        conditions.append("sip.mode_of_payment = %(mode_of_payment)s")
        values["mode_of_payment"] = filters.get("mode_of_payment")

    # Filter by cost center if provided
    if filters.get("cost_center"):
        conditions.append("si_item.cost_center = %(cost_center)s")
        values["cost_center"] = filters.get("cost_center")

    # Filter by POS Profile if provided
    if filters.get("pos_profile"):
        conditions.append("si.pos_profile = %(pos_profile)s")
        values["pos_profile"] = filters.get("pos_profile")

    # Filter by User if provided
    if filters.get("owner"):
        conditions.append("si.owner = %(owner)s")
        values["owner"] = filters.get("owner")

    # Filter by Warehouse if provided
    if filters.get("warehouse"):
        conditions.append("si_item.warehouse = %(warehouse)s")
        values["warehouse"] = filters.get("warehouse")

    # Filter by invoice status (if provided)
    if filters.get("status") and filters.get("status") not in ["Draft", "Cancelled"]:
        conditions.append("si.status = %(status)s")
        values["status"] = filters.get("status")

    # Filter for Credit Returns only if the flag is set
    if filters.get("show_credit_returns"):
        conditions.append("si.is_return = 1")  # Must be a return
        conditions.append(
            "si.return_against IS NOT NULL"
        )  # Must have a return_against value
        # The original invoice must not be a POS invoice (meaning it's a credit invoice)
        conditions.append(
            """
            (SELECT original.is_pos FROM `tabSales Invoice` original 
             WHERE original.name = si.return_against) = 0
        """
        )

    # Query to get sales invoice data
    sales_data = frappe.db.sql(
        """
        SELECT DISTINCT
            si.posting_date,
            si.posting_time,
            'Sales Invoice' as voucher_type,
            si.name as voucher_no,
            si.return_against,
            si.customer_name,
            si.status,
            si.is_return,
            si.is_pos,
            si.total_taxes_and_charges as tax_amount,
            si.grand_total,
            si.pos_profile,
            si.owner,
            si_item.warehouse,
            si_item.cost_center,
            sip.mode_of_payment,
            CASE
                WHEN si.is_return = 1 AND si.return_against IS NOT NULL THEN (
                    SELECT original.status 
                    FROM `tabSales Invoice` original 
                    WHERE original.name = si.return_against
                )
                ELSE NULL
            END as original_invoice_status,
            CASE
                WHEN si.is_return = 1 AND si.return_against IS NOT NULL THEN (
                    SELECT original.is_pos
                    FROM `tabSales Invoice` original 
                    WHERE original.name = si.return_against
                )
                ELSE NULL
            END as original_is_pos,
            CASE
                WHEN si.is_return = 1 AND si.return_against IS NOT NULL THEN (
                    SELECT original.due_date
                    FROM `tabSales Invoice` original 
                    WHERE original.name = si.return_against
                )
                ELSE NULL
            END as original_due_date,
            CASE
                WHEN si.is_return = 1 AND si.return_against IS NOT NULL THEN (
                    SELECT original.outstanding_amount
                    FROM `tabSales Invoice` original 
                    WHERE original.name = si.return_against
                )
                ELSE NULL
            END as original_outstanding_amount
        FROM
            `tabSales Invoice` si
        LEFT JOIN
            `tabSales Invoice Payment` sip ON si.name = sip.parent
        LEFT JOIN
            `tabSales Invoice Item` si_item ON si.name = si_item.parent
        WHERE
            {conditions}
        GROUP BY
            si.name
        ORDER BY
            si.posting_date DESC, si.posting_time DESC, si.name
    """.format(
            conditions=" AND ".join(conditions)
        ),
        values,
        as_dict=1,
    )

    # Process and augment data
    data = []
    for row in sales_data:
        # Improved check for credit return status
        credit_return_status = None
        if row.is_return and row.return_against:
            # Get original invoice's is_pos value (default to 0 if None)
            original_is_pos = (
                0 if row.original_is_pos is None else int(row.original_is_pos)
            )

            # Credit transaction = Not POS
            is_credit_transaction = original_is_pos == 0

            # تعريف المتغير هنا قبل استخدامه (هذا هو التغيير المطلوب)
            original_outstanding = 0

            # If the return is against a credit invoice, mark it as a credit return
            if is_credit_transaction:
                credit_return_status = _("فاتورة آجلة")

                # Add additional info if the original invoice has outstanding amount
                if row.original_outstanding_amount is not None:
                    try:
                        original_outstanding = float(row.original_outstanding_amount)
                    except (ValueError, TypeError):
                        pass

                if original_outstanding > 0:
                    credit_return_status = _("فاتورة آجلة غير مسددة")

            # Log debug info
            frappe.logger().debug(
                f"CREDIT_RETURN_CHECK: Return={row.voucher_no}, Original={row.return_against}, "
                f"is_credit={is_credit_transaction}, outstanding={original_outstanding}, "
                f"result={credit_return_status}"
            )

        # Get invoice status in Arabic
        invoice_status = get_arabic_status(row.status, row.is_return)

        # Get user's full name
        user_fullname = (
            frappe.db.get_value("User", row.owner, "full_name") if row.owner else ""
        )

        # Replace null values with empty values or default texts
        posting_date = row.posting_date or ""
        posting_time = row.posting_time or ""
        voucher_type = (
            _("فاتورة مبيعات")
            if row.voucher_type == "Sales Invoice"
            else (row.voucher_type or "")
        )
        voucher_no = row.voucher_no or ""
        return_against = row.return_against or ""
        customer_name = row.customer_name or _("غير محدد")
        tax_amount = float(row.tax_amount or 0)
        grand_total = float(row.grand_total or 0)
        pos_profile = row.pos_profile or _("غير محدد")
        owner = user_fullname or row.owner or _("غير محدد")
        warehouse = row.warehouse or _("غير محدد")
        cost_center = row.cost_center or _("غير محدد")
        mode_of_payment = row.mode_of_payment or _("غير محدد")

        # Add the sales entry to the data
        data.append(
            {
                "posting_date": posting_date,
                "posting_time": posting_time,
                "voucher_type": voucher_type,
                "voucher_no": voucher_no,
                "return_against": return_against,
                "customer_name": customer_name,
                "invoice_status": invoice_status,
                "tax_amount": tax_amount,
                "grand_total": grand_total,
                "pos_profile": pos_profile,
                "owner": owner,
                "warehouse": warehouse,
                "cost_center": cost_center,
                "mode_of_payment": mode_of_payment,
                "credit_return_status": credit_return_status,
                "is_credit_return": (
                    1 if credit_return_status else 0
                ),  # New field to make filtering easier
            }
        )

    return data


def get_arabic_status(status, is_return=0):
    """Convert invoice status to Arabic"""
    if is_return:
        return _("مرتجع مبيعات")

    status_map = {
        "Draft": _("مسودة"),
        "Submitted": _("مقدمة"),
        "Paid": _("مسددة بالكامل"),
        "Unpaid": _("غير مسددة"),
        "Partly Paid": _("مسددة جزئياً"),
        "Overdue": _("متأخرة السداد"),
        "Cancelled": _("ملغية"),
        "Credit Note Issued": _("إشعار دائن مصدر"),
    }

    return status_map.get(status, status)
