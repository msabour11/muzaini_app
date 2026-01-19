# Copyright (c) 2026, Mohamed AbdElsabour and contributors
# For license information, please see license.txt


import frappe
from frappe import _
from frappe.utils import flt, fmt_money
import datetime


def execute(filters=None):
    """
    Función principal requerida para todos los informes de ERPNext.
    Esta función debe existir y debe devolver las columnas y datos del informe.
    """
    # التأكد من وجود الفلاتر
    if not filters:
        filters = {}

    # تحديد الفترة الزمنية الافتراضية
    if not filters.get("from_date"):
        filters["from_date"] = datetime.date.today().replace(day=1)

    if not filters.get("to_date"):
        filters["to_date"] = datetime.date.today()

    # الحصول على البيانات
    columns = get_columns()
    data = get_tax_declaration_data(filters)

    # إنشاء الملخص
    summary = get_summary(data)

    return columns, data, None, None, summary


def get_columns():
    return [
        {
            "fieldname": "description",
            "label": _("البيان"),
            "fieldtype": "Data",
            "width": 450,
        },
        {
            "fieldname": "amount",
            "label": _("المبلغ"),
            "fieldtype": "Currency",
            "width": 180,
        },
        {
            "fieldname": "adjustments",
            "label": _("التعديلات"),
            "fieldtype": "Currency",
            "width": 180,
        },
        {
            "fieldname": "net_amount",
            "label": _("الصافي"),
            "fieldtype": "Currency",
            "width": 180,
        },
        {
            "fieldname": "tax_amount",
            "label": _("قيمة ضريبة القيمة المضافة"),
            "fieldtype": "Currency",
            "width": 180,
        },
    ]


def get_tax_declaration_data(filters):
    # الحصول على بيانات المبيعات والمشتريات
    # المبيعات الخاضعة للضريبة
    taxable_sales_data = get_taxable_sales_summary(filters)
    # المبيعات غير الخاضعة للضريبة
    non_taxable_sales_data = get_non_taxable_sales_summary(filters)
    # المشتريات الخاضعة للضريبة
    taxable_purchase_data = get_taxable_purchase_summary(filters)
    # المشتريات غير الخاضعة للضريبة
    non_taxable_purchase_data = get_non_taxable_purchase_summary(filters)
    # مرتجعات المبيعات الخاضعة للضريبة
    taxable_sales_returns_data = get_returns_summary(filters)
    # مرتجعات المبيعات غير الخاضعة للضريبة
    non_taxable_sales_returns_data = get_non_taxable_returns_summary(filters)
    # مرتجعات المشتريات الخاضعة للضريبة
    taxable_purchase_returns_data = get_purchase_returns_summary(filters)
    # مرتجعات المشتريات غير الخاضعة للضريبة
    non_taxable_purchase_returns_data = get_non_taxable_purchase_returns_summary(
        filters
    )

    # الحصول على بيانات الضرائب من القيود اليومية وسندات الصرف بشكل منفصل
    journal_entries_data = get_journal_entries_tax_summary(filters)
    payment_entries_data = get_payment_entries_tax_summary(filters)

    # دالة مساعدة للتنسيق مع رقمين عشريين
    def format_num(num):
        if num is None:
            return 0.00
        # First format for calculations (as a float)
        return float("{:.2f}".format(float(num)))

    # الحصول على بيانات المبيعات الخاضعة للضريبة
    taxable_sales_original_total = format_num(taxable_sales_data["base_total"])
    taxable_sales_original_tax = format_num(taxable_sales_data["tax_amount"])

    # الحصول على بيانات المبيعات غير الخاضعة للضريبة
    non_taxable_sales_original_total = format_num(non_taxable_sales_data["base_total"])

    # الحصول على بيانات المرتجعات
    taxable_sales_returns_total = format_num(taxable_sales_returns_data["base_total"])
    taxable_sales_returns_tax = format_num(taxable_sales_returns_data["tax_amount"])
    non_taxable_sales_returns_total = format_num(
        non_taxable_sales_returns_data["base_total"]
    )

    taxable_purchase_returns_total = format_num(
        taxable_purchase_returns_data["base_total"]
    )
    taxable_purchase_returns_tax = format_num(
        taxable_purchase_returns_data["tax_amount"]
    )
    non_taxable_purchase_returns_total = format_num(
        non_taxable_purchase_returns_data["base_total"]
    )

    # إجمالي مرتجعات المبيعات (الخاضعة + غير الخاضعة)
    total_sales_returns = format_num(
        taxable_sales_returns_total + non_taxable_sales_returns_total
    )

    # إجمالي مرتجعات المشتريات (الخاضعة + غير الخاضعة)
    total_purchase_returns = format_num(
        taxable_purchase_returns_total + non_taxable_purchase_returns_total
    )

    # إجمالي المبيعات (الخاضعة + غير الخاضعة)
    total_sales = format_num(
        taxable_sales_original_total + non_taxable_sales_original_total
    )

    # حساب الصافي بعد خصم المرتجعات
    taxable_sales_net_total = format_num(
        taxable_sales_original_total - taxable_sales_returns_total
    )
    taxable_sales_net_tax = format_num(
        taxable_sales_original_tax - taxable_sales_returns_tax
    )
    non_taxable_sales_net_total = format_num(
        non_taxable_sales_original_total - non_taxable_sales_returns_total
    )

    # إجمالي صافي المبيعات بعد خصم المرتجعات (الخاضعة + غير الخاضعة)
    total_sales_net = format_num(taxable_sales_net_total + non_taxable_sales_net_total)

    # الحصول على بيانات المشتريات الخاضعة للضريبة
    taxable_purchase_original_total = format_num(taxable_purchase_data["base_total"])
    taxable_purchase_original_tax = format_num(taxable_purchase_data["tax_amount"])

    # الحصول على بيانات المشتريات غير الخاضعة للضريبة
    non_taxable_purchase_original_total = format_num(
        non_taxable_purchase_data["base_total"]
    )

    # إجمالي المشتريات (الخاضعة + غير الخاضعة)
    total_purchases = format_num(
        taxable_purchase_original_total + non_taxable_purchase_original_total
    )

    # حساب إجمالي المشتريات وضرائبها (بعد خصم المرتجعات)
    taxable_purchase_net_total = format_num(
        taxable_purchase_original_total - taxable_purchase_returns_total
    )
    taxable_purchase_adjustments = format_num(
        taxable_purchase_data["adjustments"]
        - taxable_purchase_returns_data["adjustments"]
    )
    taxable_purchase_net = format_num(
        taxable_purchase_data["net_amount"]
        - taxable_purchase_returns_data["net_amount"]
    )
    taxable_purchase_tax = format_num(
        taxable_purchase_original_tax - taxable_purchase_returns_tax
    )

    non_taxable_purchase_net_total = format_num(
        non_taxable_purchase_original_total - non_taxable_purchase_returns_total
    )

    # إجمالي صافي المشتريات بعد خصم المرتجعات (الخاضعة + غير الخاضعة)
    total_purchase_net = format_num(
        taxable_purchase_net_total + non_taxable_purchase_net_total
    )

    # تحضير كميات الضرائب من القيود اليومية وسندات الصرف
    journal_entries_amount = format_num(journal_entries_data["base_total"])
    journal_entries_tax = format_num(journal_entries_data["tax_amount"])

    payment_entries_amount = format_num(payment_entries_data["base_total"])
    payment_entries_tax = format_num(payment_entries_data["tax_amount"])

    # حساب إجمالي الضريبة المستردة (المشتريات + القيود اليومية + سندات الصرف)
    total_recoverable_tax = format_num(
        taxable_purchase_tax + journal_entries_tax + payment_entries_tax
    )

    # إنشاء بيانات الإقرار الضريبي
    tax_data = [
        # قسم المبيعات
        {
            "description": "--- قسم المبيعات ---",
            "amount": "",
            "adjustments": "",
            "net_amount": "",
            "tax_amount": "",
        },
        {
            "description": "المبيعات الخاضعة للنسبة الأساسية",
            "amount": format_num(taxable_sales_data["base_total"]),
            "adjustments": format_num(taxable_sales_data["adjustments"]),
            "net_amount": format_num(taxable_sales_data["net_amount"]),
            "tax_amount": format_num(taxable_sales_data["tax_amount"]),
        },
        {
            "description": "المبيعات غير الخاضعة أو الضريبة الصفرية",
            "amount": format_num(non_taxable_sales_data["base_total"]),
            "adjustments": format_num(non_taxable_sales_data["adjustments"]),
            "net_amount": format_num(non_taxable_sales_data["net_amount"]),
            "tax_amount": 0.00,
        },
        {
            "description": "اجمالي المبيعات",
            "amount": total_sales,
            "adjustments": format_num(
                taxable_sales_data["adjustments"]
                + non_taxable_sales_data["adjustments"]
            ),
            "net_amount": format_num(
                taxable_sales_data["net_amount"] + non_taxable_sales_data["net_amount"]
            ),
            "tax_amount": format_num(taxable_sales_data["tax_amount"]),
        },
        {
            "description": "مرتجعات المبيعات الخاضعة للنسبة الأساسية",
            "amount": format_num(taxable_sales_returns_data["base_total"]),
            "adjustments": format_num(taxable_sales_returns_data["adjustments"]),
            "net_amount": format_num(taxable_sales_returns_data["net_amount"]),
            "tax_amount": format_num(taxable_sales_returns_data["tax_amount"]),
        },
        {
            "description": "مرتجعات المبيعات غير الخاضعة للضريبة",
            "amount": format_num(non_taxable_sales_returns_data["base_total"]),
            "adjustments": format_num(non_taxable_sales_returns_data["adjustments"]),
            "net_amount": format_num(non_taxable_sales_returns_data["net_amount"]),
            "tax_amount": 0.00,
        },
        {
            "description": "اجمالي مرتجعات المبيعات",
            "amount": total_sales_returns,
            "adjustments": format_num(
                taxable_sales_returns_data["adjustments"]
                + non_taxable_sales_returns_data["adjustments"]
            ),
            "net_amount": format_num(
                taxable_sales_returns_data["net_amount"]
                + non_taxable_sales_returns_data["net_amount"]
            ),
            "tax_amount": format_num(taxable_sales_returns_data["tax_amount"]),
        },
        {
            "description": "صافي المبيعات (بعد خصم المرتجعات)",
            "amount": total_sales_net,
            "adjustments": format_num(
                (
                    taxable_sales_data["adjustments"]
                    + non_taxable_sales_data["adjustments"]
                )
                - (
                    taxable_sales_returns_data["adjustments"]
                    + non_taxable_sales_returns_data["adjustments"]
                )
            ),
            "net_amount": format_num(
                (
                    taxable_sales_data["net_amount"]
                    + non_taxable_sales_data["net_amount"]
                )
                - (
                    taxable_sales_returns_data["net_amount"]
                    + non_taxable_sales_returns_data["net_amount"]
                )
            ),
            "tax_amount": taxable_sales_net_tax,
        },
        # قسم المشتريات
        {
            "description": "--- قسم المشتريات ---",
            "amount": "",
            "adjustments": "",
            "net_amount": "",
            "tax_amount": "",
        },
        {
            "description": "المشتريات الخاضعة للنسبة الأساسية",
            "amount": format_num(taxable_purchase_data["base_total"]),
            "adjustments": format_num(taxable_purchase_data["adjustments"]),
            "net_amount": format_num(taxable_purchase_data["net_amount"]),
            "tax_amount": format_num(taxable_purchase_data["tax_amount"]),
        },
        {
            "description": "المشتريات غير الخاضعة أو الضريبة الصفرية",
            "amount": format_num(non_taxable_purchase_data["base_total"]),
            "adjustments": format_num(non_taxable_purchase_data["adjustments"]),
            "net_amount": format_num(non_taxable_purchase_data["net_amount"]),
            "tax_amount": 0.00,
        },
        {
            "description": "اجمالي المشتريات",
            "amount": total_purchases,
            "adjustments": format_num(
                taxable_purchase_data["adjustments"]
                + non_taxable_purchase_data["adjustments"]
            ),
            "net_amount": format_num(
                taxable_purchase_data["net_amount"]
                + non_taxable_purchase_data["net_amount"]
            ),
            "tax_amount": format_num(taxable_purchase_data["tax_amount"]),
        },
        {
            "description": "مرتجعات المشتريات الخاضعة للنسبة الأساسية",
            "amount": format_num(taxable_purchase_returns_data["base_total"]),
            "adjustments": format_num(taxable_purchase_returns_data["adjustments"]),
            "net_amount": format_num(taxable_purchase_returns_data["net_amount"]),
            "tax_amount": format_num(taxable_purchase_returns_data["tax_amount"]),
        },
        {
            "description": "مرتجعات المشتريات غير الخاضعة للضريبة",
            "amount": format_num(non_taxable_purchase_returns_data["base_total"]),
            "adjustments": format_num(non_taxable_purchase_returns_data["adjustments"]),
            "net_amount": format_num(non_taxable_purchase_returns_data["net_amount"]),
            "tax_amount": 0.00,
        },
        {
            "description": "اجمالي مرتجعات المشتريات",
            "amount": total_purchase_returns,
            "adjustments": format_num(
                taxable_purchase_returns_data["adjustments"]
                + non_taxable_purchase_returns_data["adjustments"]
            ),
            "net_amount": format_num(
                taxable_purchase_returns_data["net_amount"]
                + non_taxable_purchase_returns_data["net_amount"]
            ),
            "tax_amount": format_num(taxable_purchase_returns_data["tax_amount"]),
        },
        {
            "description": "صافي المشتريات (بعد خصم المرتجعات)",
            "amount": total_purchase_net,
            "adjustments": format_num(
                (
                    taxable_purchase_data["adjustments"]
                    + non_taxable_purchase_data["adjustments"]
                )
                - (
                    taxable_purchase_returns_data["adjustments"]
                    + non_taxable_purchase_returns_data["adjustments"]
                )
            ),
            "net_amount": format_num(
                (
                    taxable_purchase_data["net_amount"]
                    + non_taxable_purchase_data["net_amount"]
                )
                - (
                    taxable_purchase_returns_data["net_amount"]
                    + non_taxable_purchase_returns_data["net_amount"]
                )
            ),
            "tax_amount": taxable_purchase_tax,
        },
        # قسم المصروفات
        {
            "description": "--- قسم المصروفات ---",
            "amount": "",
            "adjustments": "",
            "net_amount": "",
            "tax_amount": "",
        },
        {
            "description": "المصروفات (القيود اليومية)",
            "amount": journal_entries_amount,
            "adjustments": 0.00,
            "net_amount": journal_entries_amount,
            "tax_amount": journal_entries_tax,
        },
        {
            "description": "المصروفات (سندات الصرف)",
            "amount": payment_entries_amount,
            "adjustments": 0.00,
            "net_amount": payment_entries_amount,
            "tax_amount": payment_entries_tax,
        },
        {
            "description": "اجمالي الضريبة المستردة (المشتريات والمصروفات)",
            "amount": format_num(
                taxable_purchase_net_total
                + journal_entries_amount
                + payment_entries_amount
            ),
            "adjustments": taxable_purchase_adjustments,
            "net_amount": format_num(
                taxable_purchase_net + journal_entries_amount + payment_entries_amount
            ),
            "tax_amount": total_recoverable_tax,
        },
        # الملخص النهائي
        {
            "description": "--- الملخص النهائي ---",
            "amount": "",
            "adjustments": "",
            "net_amount": "",
            "tax_amount": "",
        },
        {
            "description": "اجمالي ضريبة القيمة المضافة المستحقة عن الفترة الضريبية الحالية",
            "amount": "",
            "adjustments": "",
            "net_amount": "",
            "tax_amount": format_num(taxable_sales_net_tax - total_recoverable_tax),
        },
    ]

    return tax_data


def get_taxable_sales_summary(filters):
    """الحصول على ملخص المبيعات الخاضعة للضريبة"""
    # استعلام موجز للمبيعات
    conditions = []
    values = {"from_date": filters.get("from_date"), "to_date": filters.get("to_date")}

    if filters.get("company"):
        conditions.append("company = %(company)s")
        values["company"] = filters.get("company")

    if filters.get("cost_center"):
        conditions.append(
            "EXISTS (SELECT name FROM `tabSales Invoice Item` WHERE parent = `tabSales Invoice`.name AND cost_center = %(cost_center)s)"
        )
        values["cost_center"] = filters.get("cost_center")

    # إضافة شرط للتأكد من وجود ضريبة على الفاتورة
    conditions.append("total_taxes_and_charges > 0")

    condition_str = " AND ".join(conditions)
    if condition_str:
        condition_str = " AND " + condition_str

    sales_summary = frappe.db.sql(
        """
        SELECT 
            COALESCE(SUM(base_grand_total), 0) as base_total,
            COALESCE(SUM(base_net_total), 0) as net_amount,
            COALESCE(SUM(base_grand_total - base_net_total), 0) as adjustments,
            COALESCE(SUM(total_taxes_and_charges), 0) as tax_amount
        FROM 
            `tabSales Invoice`
        WHERE 
            docstatus = 1
            AND is_return = 0
            AND posting_date BETWEEN %(from_date)s AND %(to_date)s
            {condition_str}
    """.format(
            condition_str=condition_str
        ),
        values,
        as_dict=1,
    )

    return (
        sales_summary[0]
        if sales_summary
        else {"base_total": 0, "net_amount": 0, "adjustments": 0, "tax_amount": 0}
    )


def get_non_taxable_sales_summary(filters):
    """الحصول على ملخص المبيعات غير الخاضعة للضريبة أو ذات الضريبة الصفرية"""
    # استعلام موجز للمبيعات غير الخاضعة للضريبة
    conditions = []
    values = {"from_date": filters.get("from_date"), "to_date": filters.get("to_date")}

    if filters.get("company"):
        conditions.append("company = %(company)s")
        values["company"] = filters.get("company")

    if filters.get("cost_center"):
        conditions.append(
            "EXISTS (SELECT name FROM `tabSales Invoice Item` WHERE parent = `tabSales Invoice`.name AND cost_center = %(cost_center)s)"
        )
        values["cost_center"] = filters.get("cost_center")

    # إضافة شرط للتأكد من عدم وجود ضريبة على الفاتورة أو ضريبة صفرية
    conditions.append(
        "(total_taxes_and_charges = 0 OR total_taxes_and_charges IS NULL)"
    )

    condition_str = " AND ".join(conditions)
    if condition_str:
        condition_str = " AND " + condition_str

    non_taxable_sales_summary = frappe.db.sql(
        """
        SELECT 
            COALESCE(SUM(base_grand_total), 0) as base_total,
            COALESCE(SUM(base_net_total), 0) as net_amount,
            COALESCE(SUM(base_grand_total - base_net_total), 0) as adjustments,
            0 as tax_amount
        FROM 
            `tabSales Invoice`
        WHERE 
            docstatus = 1
            AND is_return = 0
            AND posting_date BETWEEN %(from_date)s AND %(to_date)s
            {condition_str}
    """.format(
            condition_str=condition_str
        ),
        values,
        as_dict=1,
    )

    return (
        non_taxable_sales_summary[0]
        if non_taxable_sales_summary
        else {"base_total": 0, "net_amount": 0, "adjustments": 0, "tax_amount": 0}
    )


def get_non_taxable_returns_summary(filters):
    """الحصول على ملخص مرتجعات المبيعات غير الخاضعة للضريبة"""
    # استعلام موجز لمرتجعات المبيعات غير الخاضعة للضريبة
    conditions = []
    values = {"from_date": filters.get("from_date"), "to_date": filters.get("to_date")}

    if filters.get("company"):
        conditions.append("company = %(company)s")
        values["company"] = filters.get("company")

    if filters.get("cost_center"):
        conditions.append(
            "EXISTS (SELECT name FROM `tabSales Invoice Item` WHERE parent = `tabSales Invoice`.name AND cost_center = %(cost_center)s)"
        )
        values["cost_center"] = filters.get("cost_center")

    # إضافة شرط للتأكد من عدم وجود ضريبة على الفاتورة أو ضريبة صفرية
    conditions.append(
        "(total_taxes_and_charges = 0 OR total_taxes_and_charges IS NULL)"
    )

    condition_str = " AND ".join(conditions)
    if condition_str:
        condition_str = " AND " + condition_str

    non_taxable_returns_summary = frappe.db.sql(
        """
        SELECT 
            ABS(COALESCE(SUM(base_grand_total), 0)) as base_total,
            ABS(COALESCE(SUM(base_net_total), 0)) as net_amount,
            ABS(COALESCE(SUM(base_grand_total - base_net_total), 0)) as adjustments,
            0 as tax_amount
        FROM 
            `tabSales Invoice`
        WHERE 
            docstatus = 1
            AND is_return = 1
            AND posting_date BETWEEN %(from_date)s AND %(to_date)s
            {condition_str}
    """.format(
            condition_str=condition_str
        ),
        values,
        as_dict=1,
    )

    return (
        non_taxable_returns_summary[0]
        if non_taxable_returns_summary
        else {"base_total": 0, "net_amount": 0, "adjustments": 0, "tax_amount": 0}
    )


def get_taxable_purchase_summary(filters):
    """الحصول على ملخص المشتريات الخاضعة للضريبة"""
    # استعلام موجز للمشتريات
    conditions = []
    values = {"from_date": filters.get("from_date"), "to_date": filters.get("to_date")}

    if filters.get("company"):
        conditions.append("company = %(company)s")
        values["company"] = filters.get("company")

    if filters.get("cost_center"):
        conditions.append(
            "EXISTS (SELECT name FROM `tabPurchase Invoice Item` WHERE parent = `tabPurchase Invoice`.name AND cost_center = %(cost_center)s)"
        )
        values["cost_center"] = filters.get("cost_center")

    # إضافة شرط للتأكد من وجود ضريبة على الفاتورة
    conditions.append("total_taxes_and_charges > 0")

    condition_str = " AND ".join(conditions)
    if condition_str:
        condition_str = " AND " + condition_str

    purchase_summary = frappe.db.sql(
        """
        SELECT 
            COALESCE(SUM(base_grand_total), 0) as base_total,
            COALESCE(SUM(base_net_total), 0) as net_amount,
            COALESCE(SUM(base_grand_total - base_net_total), 0) as adjustments,
            COALESCE(SUM(total_taxes_and_charges), 0) as tax_amount
        FROM 
            `tabPurchase Invoice`
        WHERE 
            docstatus = 1
            AND is_return = 0
            AND posting_date BETWEEN %(from_date)s AND %(to_date)s
            {condition_str}
    """.format(
            condition_str=condition_str
        ),
        values,
        as_dict=1,
    )

    return (
        purchase_summary[0]
        if purchase_summary
        else {"base_total": 0, "net_amount": 0, "adjustments": 0, "tax_amount": 0}
    )


def get_non_taxable_purchase_summary(filters):
    """الحصول على ملخص المشتريات غير الخاضعة للضريبة أو ذات الضريبة الصفرية"""
    # استعلام موجز للمشتريات غير الخاضعة للضريبة
    conditions = []
    values = {"from_date": filters.get("from_date"), "to_date": filters.get("to_date")}

    if filters.get("company"):
        conditions.append("company = %(company)s")
        values["company"] = filters.get("company")

    if filters.get("cost_center"):
        conditions.append(
            "EXISTS (SELECT name FROM `tabPurchase Invoice Item` WHERE parent = `tabPurchase Invoice`.name AND cost_center = %(cost_center)s)"
        )
        values["cost_center"] = filters.get("cost_center")

    # إضافة شرط للتأكد من عدم وجود ضريبة على الفاتورة أو ضريبة صفرية
    conditions.append(
        "(total_taxes_and_charges = 0 OR total_taxes_and_charges IS NULL)"
    )

    condition_str = " AND ".join(conditions)
    if condition_str:
        condition_str = " AND " + condition_str

    non_taxable_purchase_summary = frappe.db.sql(
        """
        SELECT 
            COALESCE(SUM(base_grand_total), 0) as base_total,
            COALESCE(SUM(base_net_total), 0) as net_amount,
            COALESCE(SUM(base_grand_total - base_net_total), 0) as adjustments,
            0 as tax_amount
        FROM 
            `tabPurchase Invoice`
        WHERE 
            docstatus = 1
            AND is_return = 0
            AND posting_date BETWEEN %(from_date)s AND %(to_date)s
            {condition_str}
    """.format(
            condition_str=condition_str
        ),
        values,
        as_dict=1,
    )

    return (
        non_taxable_purchase_summary[0]
        if non_taxable_purchase_summary
        else {"base_total": 0, "net_amount": 0, "adjustments": 0, "tax_amount": 0}
    )


def get_non_taxable_purchase_returns_summary(filters):
    """الحصول على ملخص مرتجعات المشتريات غير الخاضعة للضريبة"""
    # استعلام موجز لمرتجعات المشتريات غير الخاضعة للضريبة
    conditions = []
    values = {"from_date": filters.get("from_date"), "to_date": filters.get("to_date")}

    if filters.get("company"):
        conditions.append("company = %(company)s")
        values["company"] = filters.get("company")

    if filters.get("cost_center"):
        conditions.append(
            "EXISTS (SELECT name FROM `tabPurchase Invoice Item` WHERE parent = `tabPurchase Invoice`.name AND cost_center = %(cost_center)s)"
        )
        values["cost_center"] = filters.get("cost_center")

    # إضافة شرط للتأكد من عدم وجود ضريبة على الفاتورة أو ضريبة صفرية
    conditions.append(
        "(total_taxes_and_charges = 0 OR total_taxes_and_charges IS NULL)"
    )

    condition_str = " AND ".join(conditions)
    if condition_str:
        condition_str = " AND " + condition_str

    non_taxable_purchase_returns_summary = frappe.db.sql(
        """
        SELECT 
            ABS(COALESCE(SUM(base_grand_total), 0)) as base_total,
            ABS(COALESCE(SUM(base_net_total), 0)) as net_amount,
            ABS(COALESCE(SUM(base_grand_total - base_net_total), 0)) as adjustments,
            0 as tax_amount
        FROM 
            `tabPurchase Invoice`
        WHERE 
            docstatus = 1
            AND is_return = 1
            AND posting_date BETWEEN %(from_date)s AND %(to_date)s
            {condition_str}
    """.format(
            condition_str=condition_str
        ),
        values,
        as_dict=1,
    )

    return (
        non_taxable_purchase_returns_summary[0]
        if non_taxable_purchase_returns_summary
        else {"base_total": 0, "net_amount": 0, "adjustments": 0, "tax_amount": 0}
    )


def get_returns_summary(filters):
    # استعلام موجز للمرتجعات (سندات الإشعار الدائنة)
    conditions = []
    values = {"from_date": filters.get("from_date"), "to_date": filters.get("to_date")}

    if filters.get("company"):
        conditions.append("company = %(company)s")
        values["company"] = filters.get("company")

    if filters.get("cost_center"):
        conditions.append(
            "EXISTS (SELECT name FROM `tabSales Invoice Item` WHERE parent = `tabSales Invoice`.name AND cost_center = %(cost_center)s)"
        )
        values["cost_center"] = filters.get("cost_center")

    # إضافة شرط للتأكد من وجود ضريبة على الفاتورة (مع مراعاة أن المبلغ قد يكون سالب)
    conditions.append("ABS(total_taxes_and_charges) > 0")

    condition_str = " AND ".join(conditions)
    if condition_str:
        condition_str = " AND " + condition_str

    returns_summary = frappe.db.sql(
        """
        SELECT 
            ABS(COALESCE(SUM(base_grand_total), 0)) as base_total,
            ABS(COALESCE(SUM(base_net_total), 0)) as net_amount,
            ABS(COALESCE(SUM(base_grand_total - base_net_total), 0)) as adjustments,
            ABS(COALESCE(SUM(total_taxes_and_charges), 0)) as tax_amount
        FROM 
            `tabSales Invoice`
        WHERE 
            docstatus = 1
            AND is_return = 1
            AND posting_date BETWEEN %(from_date)s AND %(to_date)s
            {condition_str}
    """.format(
            condition_str=condition_str
        ),
        values,
        as_dict=1,
    )

    return (
        returns_summary[0]
        if returns_summary
        else {"base_total": 0, "net_amount": 0, "adjustments": 0, "tax_amount": 0}
    )


def get_purchase_returns_summary(filters):
    # استعلام موجز لمرتجعات المشتريات
    conditions = []
    values = {"from_date": filters.get("from_date"), "to_date": filters.get("to_date")}

    if filters.get("company"):
        conditions.append("company = %(company)s")
        values["company"] = filters.get("company")

    if filters.get("cost_center"):
        conditions.append(
            "EXISTS (SELECT name FROM `tabPurchase Invoice Item` WHERE parent = `tabPurchase Invoice`.name AND cost_center = %(cost_center)s)"
        )
        values["cost_center"] = filters.get("cost_center")

    # إضافة شرط للتأكد من وجود ضريبة على الفاتورة (مع مراعاة أن المبلغ قد يكون سالب)
    conditions.append("ABS(total_taxes_and_charges) > 0")

    condition_str = " AND ".join(conditions)
    if condition_str:
        condition_str = " AND " + condition_str

    purchase_returns_summary = frappe.db.sql(
        """
        SELECT 
            ABS(COALESCE(SUM(base_grand_total), 0)) as base_total,
            ABS(COALESCE(SUM(base_net_total), 0)) as net_amount,
            ABS(COALESCE(SUM(base_grand_total - base_net_total), 0)) as adjustments,
            ABS(COALESCE(SUM(total_taxes_and_charges), 0)) as tax_amount
        FROM 
            `tabPurchase Invoice`
        WHERE 
            docstatus = 1
            AND is_return = 1
            AND posting_date BETWEEN %(from_date)s AND %(to_date)s
            {condition_str}
    """.format(
            condition_str=condition_str
        ),
        values,
        as_dict=1,
    )

    return (
        purchase_returns_summary[0]
        if purchase_returns_summary
        else {"base_total": 0, "net_amount": 0, "adjustments": 0, "tax_amount": 0}
    )


def get_tax_accounts(filters):
    """الحصول على قائمة بالحسابات الضريبية في ERPNext - نسخة محسنة ومركزة"""
    company = filters.get("company")

    if not company:
        return []

    # جمع كل الحسابات الضريبية في قائمة واحدة
    all_tax_accounts = []

    # 1. الحسابات ذات النوع "Tax" (الأكثر دقة)
    tax_type_accounts = frappe.db.sql(
        """
        SELECT name FROM `tabAccount` 
        WHERE company = %s AND is_group = 0 AND account_type = 'Tax'
    """,
        (company),
        as_dict=0,
    )

    # 2. الحسابات تحت مجموعات الضرائب الرئيسية
    tax_group_accounts = frappe.db.sql(
        """
        SELECT a.name 
        FROM `tabAccount` a
        JOIN `tabAccount` parent ON a.parent_account = parent.name
        WHERE a.company = %s AND a.is_group = 0 
        AND (
            parent.account_name LIKE '%%Duties and Taxes%%' OR
            parent.account_name LIKE '%%ضرائب%%' OR
            parent.account_name LIKE '%%ضريبة%%' OR
            parent.account_name LIKE '%%VAT%%'
        )
    """,
        (company),
        as_dict=0,
    )

    # 3. الحسابات ذات الأسماء المتعلقة بالضرائب (مثل ضريبة القيمة المضافة أو VAT)
    tax_named_accounts = frappe.db.sql(
        """
        SELECT name FROM `tabAccount`
        WHERE company = %s AND is_group = 0
        AND (
            account_name LIKE '%%ضريب%%' OR 
            account_name LIKE '%%VAT%%' OR
            name LIKE '%%ضريب%%' OR 
            name LIKE '%%VAT%%'
        )
    """,
        (company),
        as_dict=0,
    )

    # إضافة كل النتائج إلى القائمة
    if tax_type_accounts:
        all_tax_accounts.extend([x[0] for x in tax_type_accounts])

    if tax_group_accounts:
        all_tax_accounts.extend([x[0] for x in tax_group_accounts])

    if tax_named_accounts:
        all_tax_accounts.extend([x[0] for x in tax_named_accounts])

    # إزالة التكرارات والقيم الفارغة
    unique_tax_accounts = list(set([acc for acc in all_tax_accounts if acc]))

    return unique_tax_accounts if unique_tax_accounts else []


def get_journal_entries_tax_summary(filters):
    """الحصول على ضريبة المصروفات من القيود اليومية فقط - للحسابات الضريبية فقط"""
    # قائمة بالحسابات الضريبية
    tax_accounts = get_tax_accounts(filters)

    if not tax_accounts:
        return {"base_total": 0, "tax_amount": 0}

    conditions = []
    values = {
        "from_date": filters.get("from_date"),
        "to_date": filters.get("to_date"),
        "tax_accounts": tax_accounts,
    }

    if filters.get("company"):
        conditions.append("je.company = %(company)s")
        values["company"] = filters.get("company")

    if filters.get("cost_center"):
        conditions.append("jea.cost_center = %(cost_center)s")
        values["cost_center"] = filters.get("cost_center")

    # إذا تم تحديد حساب ضريبي، نقوم بتصفية البيانات وفقًا لذلك
    if filters.get("tax_account"):
        conditions.append("jea.account = %(tax_account)s")
        values["tax_account"] = filters.get("tax_account")
    else:
        # استخدام قائمة الحسابات الضريبية
        conditions.append("jea.account IN %(tax_accounts)s")

    # شرط إضافي للتأكد من أن نوع القيد هو "قيد يومي"
    conditions.append("je.voucher_type = 'Journal Entry'")

    # إضافة شرط للتأكد من أن قيمة المدين لحساب الضريبة أكبر من الصفر
    conditions.append("jea.debit > 0")

    condition_str = " AND ".join(conditions)
    if condition_str:
        condition_str = " AND " + condition_str

    # استعلام القيود اليومية التي تحتوي على ضرائب - للمدين
    debit_tax_summary = frappe.db.sql(
        """
        SELECT 
            COALESCE(SUM(jea.debit), 0) as base_total,
            COALESCE(SUM(jea.debit), 0) as tax_amount
        FROM 
            `tabJournal Entry` je
        INNER JOIN
            `tabJournal Entry Account` jea ON je.name = jea.parent
        WHERE 
            je.docstatus = 1
            AND je.posting_date BETWEEN %(from_date)s AND %(to_date)s
            {condition_str}
    """.format(
            condition_str=condition_str
        ),
        values,
        as_dict=1,
    )

    return (
        debit_tax_summary[0]
        if debit_tax_summary
        else {"base_total": 0, "tax_amount": 0}
    )


def get_payment_entries_tax_summary(filters):
    """الحصول على ضريبة المصروفات من سندات الصرف من خلال القيود المحاسبية"""
    # الحصول على حسابات الضرائب
    tax_accounts = get_tax_accounts(filters)

    if not tax_accounts:
        return {"base_total": 0, "tax_amount": 0}

    conditions = []
    values = {
        "from_date": filters.get("from_date"),
        "to_date": filters.get("to_date"),
        "tax_accounts": tax_accounts,
    }

    if filters.get("company"):
        conditions.append("gl.company = %(company)s")
        values["company"] = filters.get("company")

    # فلتر حساب الضريبة
    if filters.get("tax_account"):
        conditions.append("gl.account = %(tax_account)s")
        values["tax_account"] = filters.get("tax_account")
    else:
        conditions.append("gl.account IN %(tax_accounts)s")

    # فلترة حسب سندات المدفوعات فقط
    conditions.append("gl.voucher_type = 'Payment Entry'")

    condition_str = " AND ".join(conditions)
    if condition_str:
        condition_str = " AND " + condition_str

    # استعلام للحصول على مبلغ الضريبة من القيود المحاسبية
    payment_entries_summary = frappe.db.sql(
        """
        SELECT 
            COALESCE(SUM(gl.debit), 0) as base_total,
            COALESCE(SUM(gl.debit), 0) as tax_amount
        FROM 
            `tabGL Entry` gl
        WHERE 
            gl.docstatus = 1
            AND gl.posting_date BETWEEN %(from_date)s AND %(to_date)s
            AND gl.debit > 0
            {condition_str}
    """.format(
            condition_str=condition_str
        ),
        values,
        as_dict=1,
    )

    return (
        payment_entries_summary[0]
        if payment_entries_summary
        else {"base_total": 0, "tax_amount": 0}
    )


def get_summary(data):
    # دالة للتنسيق العملات مع فواصل الألوف
    def format_with_commas(amount):
        if amount is None or amount == "":
            return "0.00"
        try:
            return fmt_money(float(amount), precision=2)
        except (ValueError, TypeError):
            return "0.00"

    # البحث عن الصفوف المطلوبة في البيانات باستخدام الوصف
    def find_row(description):
        return next(
            (row for row in data if row.get("description") == description),
            {"amount": 0, "tax_amount": 0},
        )

    # الحصول على بيانات الصفوف المهمة
    taxable_sales = find_row("المبيعات الخاضعة للنسبة الأساسية")
    non_taxable_sales = find_row("المبيعات غير الخاضعة أو الضريبة الصفرية")
    total_sales = find_row("اجمالي المبيعات")
    taxable_sales_returns = find_row("مرتجعات المبيعات الخاضعة للنسبة الأساسية")
    non_taxable_sales_returns = find_row("مرتجعات المبيعات غير الخاضعة للضريبة")
    total_sales_returns = find_row("اجمالي مرتجعات المبيعات")
    sales_net = find_row("صافي المبيعات (بعد خصم المرتجعات)")

    taxable_purchases = find_row("المشتريات الخاضعة للنسبة الأساسية")
    non_taxable_purchases = find_row("المشتريات غير الخاضعة أو الضريبة الصفرية")
    total_purchases = find_row("اجمالي المشتريات")
    taxable_purchase_returns = find_row("مرتجعات المشتريات الخاضعة للنسبة الأساسية")
    non_taxable_purchase_returns = find_row("مرتجعات المشتريات غير الخاضعة للضريبة")
    total_purchase_returns = find_row("اجمالي مرتجعات المشتريات")
    purchase_net = find_row("صافي المشتريات (بعد خصم المرتجعات)")

    journal_entries = find_row("المصروفات (القيود اليومية)")
    payment_entries = find_row("المصروفات (سندات الصرف)")
    total_recoverable = find_row("اجمالي الضريبة المستردة (المشتريات والمصروفات)")

    vat_due = find_row(
        "اجمالي ضريبة القيمة المضافة المستحقة عن الفترة الضريبية الحالية"
    )

    # إعداد ملخص التقرير
    return [
        {
            "label": _("المبيعات الخاضعة للضريبة"),
            "value": format_with_commas(taxable_sales.get("amount")),
            "indicator": "Green",
        },
        {
            "label": _("ضريبة المبيعات الخاضعة"),
            "value": format_with_commas(taxable_sales.get("tax_amount")),
            "indicator": "Green",
        },
        {
            "label": _("المبيعات غير الخاضعة"),
            "value": format_with_commas(non_taxable_sales.get("amount")),
            "indicator": "Blue",
        },
        {
            "label": _("اجمالي المبيعات"),
            "value": format_with_commas(total_sales.get("amount")),
            "indicator": "Green",
        },
        {
            "label": _("مرتجعات المبيعات الخاضعة"),
            "value": format_with_commas(taxable_sales_returns.get("amount")),
            "indicator": "Red",
        },
        {
            "label": _("مرتجعات المبيعات غير الخاضعة"),
            "value": format_with_commas(non_taxable_sales_returns.get("amount")),
            "indicator": "Red",
        },
        {
            "label": _("اجمالي مرتجعات المبيعات"),
            "value": format_with_commas(total_sales_returns.get("amount")),
            "indicator": "Red",
        },
        {
            "label": _("ضريبة مرتجعات المبيعات"),
            "value": format_with_commas(taxable_sales_returns.get("tax_amount")),
            "indicator": "Red",
        },
        {
            "label": _("صافي المبيعات"),
            "value": format_with_commas(sales_net.get("amount")),
            "indicator": "Green",
        },
        {
            "label": _("صافي ضريبة المبيعات"),
            "value": format_with_commas(sales_net.get("tax_amount")),
            "indicator": "Green",
        },
        {
            "label": _("المشتريات الخاضعة للضريبة"),
            "value": format_with_commas(taxable_purchases.get("amount")),
            "indicator": "Blue",
        },
        {
            "label": _("ضريبة المشتريات الخاضعة"),
            "value": format_with_commas(taxable_purchases.get("tax_amount")),
            "indicator": "Blue",
        },
        {
            "label": _("المشتريات غير الخاضعة"),
            "value": format_with_commas(non_taxable_purchases.get("amount")),
            "indicator": "Blue",
        },
        {
            "label": _("اجمالي المشتريات"),
            "value": format_with_commas(total_purchases.get("amount")),
            "indicator": "Blue",
        },
        {
            "label": _("مرتجعات المشتريات الخاضعة"),
            "value": format_with_commas(taxable_purchase_returns.get("amount")),
            "indicator": "Red",
        },
        {
            "label": _("مرتجعات المشتريات غير الخاضعة"),
            "value": format_with_commas(non_taxable_purchase_returns.get("amount")),
            "indicator": "Red",
        },
        {
            "label": _("اجمالي مرتجعات المشتريات"),
            "value": format_with_commas(total_purchase_returns.get("amount")),
            "indicator": "Red",
        },
        {
            "label": _("ضريبة مرتجعات المشتريات"),
            "value": format_with_commas(taxable_purchase_returns.get("tax_amount")),
            "indicator": "Red",
        },
        {
            "label": _("صافي المشتريات"),
            "value": format_with_commas(purchase_net.get("amount")),
            "indicator": "Blue",
        },
        {
            "label": _("صافي ضريبة المشتريات"),
            "value": format_with_commas(purchase_net.get("tax_amount")),
            "indicator": "Blue",
        },
        {
            "label": _("ضريبة المصروفات (القيود اليومية)"),
            "value": format_with_commas(journal_entries.get("tax_amount")),
            "indicator": "Purple",
        },
        {
            "label": _("ضريبة المصروفات (سندات الصرف)"),
            "value": format_with_commas(payment_entries.get("tax_amount")),
            "indicator": "Purple",
        },
        {
            "label": _("اجمالي الضريبة المستردة"),
            "value": format_with_commas(total_recoverable.get("tax_amount")),
            "indicator": "Blue",
        },
        {
            "label": _("الفرق الضريبي المستحق"),
            "value": format_with_commas(vat_due.get("tax_amount")),
            "indicator": (
                "Red" if float(vat_due.get("tax_amount") or 0) < 0 else "Green"
            ),
        },
    ]
