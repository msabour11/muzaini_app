// Copyright (c) 2026, Mohamed AbdElsabour and contributors
// For license information, please see license.txt

frappe.query_reports["Tax Declaration Report"] = {
	filters: [
		{
			fieldname: "company",
			label: __("الشركة"),
			fieldtype: "Link",
			options: "Company",
			default: frappe.defaults.get_user_default("Company"),
			reqd: 1,
			width: "200px",
		},
		{
			fieldname: "cost_center",
			label: __("مركز التكلفة"),
			fieldtype: "Link",
			options: "Cost Center",
			get_query: function () {
				var company = frappe.query_report.get_filter_value("company");
				return {
					filters: {
						company: company,
						is_group: 0,
					},
				};
			},
			width: "200px",
		},
		{
			fieldname: "from_date",
			label: __("من تاريخ"),
			fieldtype: "Date",
			default: frappe.datetime.add_months(frappe.datetime.get_today(), -3),
			reqd: 1,
			width: "100px",
		},
		{
			fieldname: "to_date",
			label: __("إلى تاريخ"),
			fieldtype: "Date",
			default: frappe.datetime.get_today(),
			reqd: 1,
			width: "100px",
		},
		{
			fieldname: "tax_account",
			label: __("حساب الضريبة"),
			fieldtype: "Link",
			options: "Account",
			get_query: function () {
				var company = frappe.query_report.get_filter_value("company");
				if (!company) return;

				// Filtro mejorado que solo muestra cuentas relacionadas con impuestos
				return {
					filters: [
						["Account", "company", "=", company],
						["Account", "is_group", "=", 0],
					],
					or_filters: [
						// Identificadores principales de cuentas de impuestos
						["Account", "account_type", "=", "Tax"],
						// Cuentas bajo grupos de impuestos
						["Account", "parent_account", "like", "%Duties and Taxes%"],
						["Account", "parent_account", "like", "%ضرائب%"],
						["Account", "parent_account", "like", "%ضريبة%"],
						// Términos específicos de IVA
						["Account", "account_name", "like", "%ضريب%"],
						["Account", "account_name", "like", "%VAT%"],
						["Account", "account_name", "like", "%ضريبة القيمة المضافة%"],
						// Solo códigos de cuenta específicos de impuestos
						["Account", "name", "like", "%ضريب%"],
						["Account", "name", "like", "%VAT%"],
					],
				};
			},
			width: "200px",
			hidden: 1,
			description: __("اختياري: يستخدم لتصفية ضريبة المصروفات حسب حساب محدد"),
		},
		{
			fieldname: "report_type",
			label: __("نوع التقرير"),
			fieldtype: "Select",
			options: "شهري\nربع سنوي\nسنوي",
			default: "شهري",
			hidden: 1,
			width: "100px",
		},
		{
			fieldname: "include_cancelled",
			label: __("تضمين الفواتير الملغاة"),
			fieldtype: "Check",
			hidden: 1,
			default: 0,
		},
		{
			fieldname: "show_non_taxable",
			label: __("إظهار العناصر غير الخاضعة للضريبة"),
			fieldtype: "Check",
			hidden: 1,
			default: 1,
		},
	],
	formatter: function (value, row, column, data, default_formatter) {
		// Apply thousand separators to currency columns
		if (
			column.fieldtype === "Currency" &&
			value !== null &&
			value !== undefined &&
			value !== ""
		) {
			// Format numeric values with thousand separators
			var formatted_value = format_currency(value, column.options);

			// تخصيص التنسيق للصفوف الهامة مع الحفاظ على التنسيق المالي
			if (data) {
				// التعرف على عناوين الأقسام
				if (data.description && data.description.startsWith("---")) {
					return (
						'<span style="font-weight: bold; font-size: 1.2em; color: #34495e; background-color: #f8f9fa; padding: 5px 10px; display: block; border-radius: 3px;">' +
						data.description.replace(/---/g, "") +
						"</span>"
					);
				}

				// تنسيق خاص للمجاميع والعناوين الرئيسية
				if (
					data.description &&
					(data.description.includes("اجمالي") ||
						data.description.includes("صافي") ||
						data.description.includes("الفرق الضريبي"))
				) {
					return (
						'<span style="font-weight: bold; font-size: 1.1em; color: #2c3e50;">' +
						formatted_value +
						"</span>"
					);
				}

				// إبراز المبيعات الخاضعة والغير خاضعة
				if (data.description && data.description.includes("المبيعات الخاضعة")) {
					return (
						'<span style="color: #27ae60; font-weight: bold;">' +
						formatted_value +
						"</span>"
					);
				}

				if (data.description && data.description.includes("المبيعات غير الخاضعة")) {
					return (
						'<span style="color: #3498db; font-weight: bold;">' +
						formatted_value +
						"</span>"
					);
				}

				// إبراز المشتريات الخاضعة والغير خاضعة
				if (data.description && data.description.includes("المشتريات الخاضعة")) {
					return (
						'<span style="color: #2980b9; font-weight: bold;">' +
						formatted_value +
						"</span>"
					);
				}

				if (data.description && data.description.includes("المشتريات غير الخاضعة")) {
					return (
						'<span style="color: #3498db; font-weight: bold;">' +
						formatted_value +
						"</span>"
					);
				}

				// إبراز صفوف المرتجعات
				if (data.description && data.description.includes("مرتجعات")) {
					return (
						'<span style="color: #e74c3c; font-weight: bold;">' +
						formatted_value +
						"</span>"
					);
				}

				// إبراز صفوف إجمالي المرتجعات
				if (
					data.description &&
					(data.description === "اجمالي مرتجعات المبيعات" ||
						data.description === "اجمالي مرتجعات المشتريات")
				) {
					return (
						'<span style="color: #e74c3c; font-weight: bold; font-size: 1.05em;">' +
						formatted_value +
						"</span>"
					);
				}

				// تنسيق خاص لضريبة المصروفات
				if (data.description && data.description.includes("المصروفات")) {
					return (
						'<span style="color: #8e44ad; font-weight: bold;">' +
						formatted_value +
						"</span>"
					);
				}

				// تنسيق قيم الضرائب
				if (column.fieldname === "tax_amount") {
					if (
						data.description ===
						"اجمالي ضريبة القيمة المضافة المستحقة عن الفترة الضريبية الحالية"
					) {
						var tax_value = parseFloat(value || 0);
						return tax_value < 0
							? '<span style="color: #e74c3c; font-weight: bold; font-size: 1.2em;">' +
									formatted_value +
									"</span>"
							: '<span style="color: #27ae60; font-weight: bold; font-size: 1.2em;">' +
									formatted_value +
									"</span>";
					} else if (data.description === "المصروفات (القيود اليومية)") {
						return (
							'<span style="color: #8e44ad; font-weight: bold;">' +
							formatted_value +
							"</span>"
						);
					} else if (data.description === "المصروفات (سندات الصرف)") {
						return (
							'<span style="color: #8e44ad; font-weight: bold;">' +
							formatted_value +
							"</span>"
						);
					} else {
						return '<span style="color: #2980b9;">' + formatted_value + "</span>";
					}
				}

				// تلوين صف الضريبة المستحقة بالكامل
				if (
					data.description ===
					"اجمالي ضريبة القيمة المضافة المستحقة عن الفترة الضريبية الحالية"
				) {
					return (
						'<span style="font-weight: bold; font-size: 1.1em; color: #34495e;">' +
						formatted_value +
						"</span>"
					);
				}
			}

			return formatted_value;
		}

		return default_formatter(value, row, column, data);
	},
	initial_setup: true,
	show_filters_on_top: true,
	onload: function (report) {
		// تطبيق ستايل للجدول مباشرة عند التحميل
		report.page.wrapper.find(".datatable").addClass("tax-declaration-table");

		// التأكد من ظهور الفلاتر
		report.page.show_form();

		// إضافة CSS مخصص
		$(
			"<style>\
            .tax-declaration-table .dt-cell { padding: 12px !important; vertical-align: middle; }\
            .tax-declaration-table .dt-row { border-bottom: 1px solid #eee; }\
            .tax-declaration-table .dt-header .dt-cell { background-color: #f5f7fa; font-weight: bold; font-size: 1.1em; color: #34495e; }\
            .tax-declaration-table .dt-scrollable { border: 1px solid #dfe6e9; border-radius: 5px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }\
            .tax-declaration-table .dt-row:nth-child(even) { background-color: #f9f9f9; }\
            .tax-declaration-table .dt-row:hover { background-color: #f5f7fa; }\
            .section-header { background-color: #f8f9fa !important; border-bottom: 2px solid #ddd !important; }\
            .section-header .dt-cell { font-size: 1.2em !important; color: #34495e !important; }\
            .tax-summary-section { margin: 20px 0 30px; border: 1px solid #e0e0e0; border-radius: 6px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }\
            .tax-summary-header { padding: 15px; background-color: #f5f7fa; border-bottom: 1px solid #e0e0e0; display: flex; justify-content: space-between; align-items: center; }\
            .tax-summary-header h3 { margin: 0; color: #2c3e50; font-size: 16px; font-weight: bold; }\
            .tax-summary-content { display: flex; flex-wrap: wrap; padding: 15px; gap: 15px; }\
            .tax-summary-column { flex: 1; min-width: 300px; }\
            .tax-summary-card { border: 1px solid #e0e0e0; border-radius: 5px; overflow: hidden; margin-bottom: 15px; }\
            .tax-summary-card-header { padding: 10px 15px; font-weight: bold; color: white; }\
            .tax-summary-card-body { padding: 15px; }\
            .tax-summary-item { display: flex; justify-content: space-between; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid #f0f0f0; }\
            .tax-summary-item-label { font-weight: 500; }\
            .tax-summary-item-value { font-weight: bold; }\
            .sales-card-header { background-color: #27ae60; }\
            .purchases-card-header { background-color: #2980b9; }\
            .expenses-card-header { background-color: #8e44ad; }\
            .summary-card-header { background-color: #34495e; }\
            .report-filter { border: 1px solid #ddd; padding: 10px; border-radius: 4px; margin-bottom: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }\
            .filter-label { font-weight: bold; }\
            .frappe-control .control-input { height: 38px; }\
            .summary-row { border-bottom: 1px solid #f0f0f0; padding-bottom: 5px; }\
            .tax-due-container { text-align: center; padding: 20px; border-radius: 8px; margin-top: 20px; }\
            .tax-due-label { font-size: 16px; font-weight: bold; margin-bottom: 10px; }\
            .tax-due-value { font-size: 24px; font-weight: bold; }\
            .tax-due-positive { background-color: #d4edda; border: 2px solid #c3e6cb; color: #155724; }\
            .tax-due-negative { background-color: #f8d7da; border: 2px solid #f5c6cb; color: #721c24; }\
        </style>",
		).appendTo("head");

		// تعديل سلوك فلتر مركز التكلفة لتحديثه عند تغيير الشركة
		report.page.wrapper.find('[data-fieldname="company"]').on("change", function () {
			var company = $(this).val();
			var cost_center_filter = report.page.wrapper.find('[data-fieldname="cost_center"]');

			if (cost_center_filter.length) {
				var cost_center_field = cost_center_filter.find("input");
				// تفريغ حقل مركز التكلفة عند تغيير الشركة
				cost_center_field.val("").trigger("change");
			}

			// إعادة تحميل حساب الضريبة عند تغيير الشركة
			var tax_account_filter = report.page.wrapper.find('[data-fieldname="tax_account"]');
			if (tax_account_filter.length) {
				var tax_account_field = tax_account_filter.find("input");
				tax_account_field.val("").trigger("change");
			}
		});

		// إضافة زر لعرض نموذج الإقرار الضريبي
		report.page.add_inner_button(__("نموذج الإقرار الضريبي"), function () {
			// استخدام البيانات الموجودة بالفعل في التقرير بدلاً من طلبها مرة أخرى
			if (report.data && report.data.length > 0) {
				var data = report.data;
				var filters = report.get_values();

				// إنشاء نموذج الإقرار الضريبي
				var html = createTaxDeclarationForm(data, filters);

				// فتح نافذة جديدة وعرض النموذج
				var w = window.open();
				w.document.write(html);
				w.document.close();
				setTimeout(function () {
					w.print();
				}, 1000);
			} else {
				frappe.msgprint(__("لا توجد بيانات لعرضها. يرجى التحقق من المرشحات."));
			}
		});

		// إضافة زر للتصدير
		report.page.add_inner_button(__("تصدير"), function () {
			// استخدام البيانات الموجودة بالفعل في التقرير بدلاً من طلبها مرة أخرى
			if (report.data && report.data.length > 0) {
				var data = report.data;
				var filters = report.get_values();

				downloadCSV(
					data,
					"tax_declaration_" + filters.from_date + "_to_" + filters.to_date + ".csv",
				);
			} else {
				frappe.msgprint(__("لا توجد بيانات للتصدير"));
			}
		});

		// تحديث البيانات عند التحميل
		var originalRefresh = report.refresh;
		report.refresh = function () {
			originalRefresh.call(this);

			// التأكد من أن البيانات متاحة
			if (report.data && report.data.length > 0) {
				// إزالة الأقسام السابقة إذا وجدت
				$(".tax-summary-section").remove();

				// إنشاء قسم ملخص الضرائب في الأعلى (إذا لم يكن موجود)
				var $taxSummarySection = $('<div class="tax-summary-section"></div>');
				report.page.main.find(".report-filter-section").after($taxSummarySection);

				// تحديث الملخص
				updateTaxSummary(report.data);

				// تطبيق ستايل لتمييز أقسام التقرير
				setTimeout(function () {
					report.page.wrapper.find(".datatable .dt-row").each(function (index) {
						var $row = $(this);
						var rowData = report.data[index];

						if (
							rowData &&
							rowData.description &&
							rowData.description.startsWith("---")
						) {
							$row.addClass("section-header");
							$row.css({
								"background-color": "#f8f9fa",
								"border-bottom": "2px solid #ddd",
								"font-weight": "bold",
							});
						}

						// إضافة تلوين للصفوف حسب نوعها
						if (rowData && rowData.description) {
							if (
								rowData.description.includes("اجمالي") ||
								rowData.description.includes("صافي")
							) {
								$row.css({
									"background-color": "#f8fafc",
									"font-weight": "bold",
								});
							}

							if (rowData.description.includes("مرتجعات")) {
								$row.css({
									"background-color": "#fff5f5",
								});
							}

							if (rowData.description.includes("المصروفات")) {
								$row.css({
									"background-color": "#f9f4fc",
								});
							}

							if (
								rowData.description ===
								"اجمالي ضريبة القيمة المضافة المستحقة عن الفترة الضريبية الحالية"
							) {
								$row.css({
									"background-color": "#f1f5f9",
									"font-weight": "bold",
									"border-top": "2px solid #cbd5e1",
									"border-bottom": "2px solid #cbd5e1",
								});
							}

							if (rowData.description.includes("غير الخاضعة")) {
								$row.css({
									"background-color": "#f0f8ff",
								});
							}
						}
					});
				}, 500);
			}
		};
	},
};

// دالة لإنشاء نموذج الإقرار الضريبي
function createTaxDeclarationForm(data, filters) {
	// تنسيق التاريخ
	var formatDate = function (dateStr) {
		if (!dateStr) return "";
		var d = new Date(dateStr);
		return d.toLocaleDateString("ar-EG", {
			day: "2-digit",
			month: "2-digit",
			year: "numeric",
		});
	};

	var currentDate = frappe.datetime.get_today();
	var currentTime = frappe.datetime.now_time();

	// البحث عن الصفوف المطلوبة في البيانات الجديدة
	// إنشاء وظيفة للبحث عن المعلومات حسب الوصف
	var findRow = function (description) {
		return data.find((row) => row.description === description);
	};

	// المبيعات
	var taxableSalesRow = findRow("المبيعات الخاضعة للنسبة الأساسية");
	var nonTaxableSalesRow = findRow("المبيعات غير الخاضعة أو الضريبة الصفرية");
	var totalSalesRow = findRow("اجمالي المبيعات");
	var salesReturnsRow = findRow("مرتجعات المبيعات الخاضعة للنسبة الأساسية");
	var salesNetRow = findRow("صافي المبيعات (بعد خصم المرتجعات)");

	// المشتريات
	var taxablePurchaseRow = findRow("المشتريات الخاضعة للنسبة الأساسية");
	var nonTaxablePurchaseRow = findRow("المشتريات غير الخاضعة أو الضريبة الصفرية");
	var totalPurchaseRow = findRow("اجمالي المشتريات");
	var purchaseReturnsRow = findRow("مرتجعات المشتريات الخاضعة للنسبة الأساسية");
	var purchaseNetRow = findRow("صافي المشتريات (بعد خصم المرتجعات)");

	// المصروفات
	var expensesJERow = findRow("المصروفات (القيود اليومية)");
	var expensesPERow = findRow("المصروفات (سندات الصرف)");
	var totalRecoverableRow = findRow("اجمالي الضريبة المستردة (المشتريات والمصروفات)");

	// الضريبة المستحقة
	var vatDueRow = findRow("اجمالي ضريبة القيمة المضافة المستحقة عن الفترة الضريبية الحالية");

	// إنشاء جداول ملخصة
	var salesPanel = `
    <div style="width: 49%; float: right; margin-left: 1%; border: 1px solid #ddd; border-radius: 4px; overflow: hidden;">
        <div style="background-color: #27ae60; color: white; padding: 10px; text-align: center; font-weight: bold; border-bottom: 1px solid #ddd;">
            المبيعات
        </div>
        <div style="padding: 15px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px; border-bottom: 1px solid #eee; padding-bottom: 5px;">
                <div style="font-weight: bold; text-align: right;">المبيعات الخاضعة للضريبة:</div>
                <div style="direction: ltr;">${format_currency(taxableSalesRow.amount)}</div>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px; border-bottom: 1px solid #eee; padding-bottom: 5px;">
                <div style="font-weight: bold; text-align: right;">ضريبة المبيعات الخاضعة:</div>
                <div style="direction: ltr; color: #27ae60;">${format_currency(taxableSalesRow.tax_amount)}</div>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px; border-bottom: 1px solid #eee; padding-bottom: 5px;">
                <div style="font-weight: bold; text-align: right;">المبيعات غير الخاضعة للضريبة:</div>
                <div style="direction: ltr;">${format_currency(nonTaxableSalesRow.amount)}</div>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px; border-bottom: 1px solid #eee; padding-bottom: 5px;">
                <div style="font-weight: bold; text-align: right;">اجمالي المبيعات:</div>
                <div style="direction: ltr; font-weight: bold;">${format_currency(totalSalesRow.amount)}</div>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px; border-bottom: 1px solid #eee; padding-bottom: 5px;">
                <div style="font-weight: bold; text-align: right;">مرتجعات المبيعات:</div>
                <div style="direction: ltr; color: #e74c3c;">${format_currency(salesReturnsRow.amount)}</div>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px; border-bottom: 1px solid #eee; padding-bottom: 5px;">
                <div style="font-weight: bold; text-align: right;">ضريبة المرتجعات:</div>
                <div style="direction: ltr; color: #e74c3c;">${format_currency(salesReturnsRow.tax_amount)}</div>
            </div>
            <hr style="border-top: 1px solid #eee; margin: 10px 0;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                <div style="font-weight: bold; text-align: right;">صافي المبيعات:</div>
                <div style="direction: ltr; font-weight: bold;">${format_currency(salesNetRow.amount)}</div>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                <div style="font-weight: bold; text-align: right;">صافي ضريبة المبيعات:</div>
                <div style="direction: ltr; color: #27ae60; font-weight: bold;">${format_currency(salesNetRow.tax_amount)}</div>
            </div>
        </div>
    </div>
    `;

	var purchasePanel = `
    <div style="width: 49%; float: left; border: 1px solid #ddd; border-radius: 4px; overflow: hidden;">
        <div style="background-color: #2980b9; color: white; padding: 10px; text-align: center; font-weight: bold; border-bottom: 1px solid #ddd;">
            المشتريات
        </div>
        <div style="padding: 15px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px; border-bottom: 1px solid #eee; padding-bottom: 5px;">
                <div style="font-weight: bold; text-align: right;">المشتريات الخاضعة للضريبة:</div>
                <div style="direction: ltr;">${format_currency(taxablePurchaseRow.amount)}</div>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px; border-bottom: 1px solid #eee; padding-bottom: 5px;">
                <div style="font-weight: bold; text-align: right;">ضريبة المشتريات الخاضعة:</div>
                <div style="direction: ltr; color: #2980b9;">${format_currency(taxablePurchaseRow.tax_amount)}</div>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px; border-bottom: 1px solid #eee; padding-bottom: 5px;">
                <div style="font-weight: bold; text-align: right;">المشتريات غير الخاضعة للضريبة:</div>
                <div style="direction: ltr;">${format_currency(nonTaxablePurchaseRow.amount)}</div>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px; border-bottom: 1px solid #eee; padding-bottom: 5px;">
                <div style="font-weight: bold; text-align: right;">اجمالي المشتريات:</div>
                <div style="direction: ltr; font-weight: bold;">${format_currency(totalPurchaseRow.amount)}</div>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px; border-bottom: 1px solid #eee; padding-bottom: 5px;">
                <div style="font-weight: bold; text-align: right;">مرتجعات المشتريات:</div>
                <div style="direction: ltr; color: #e74c3c;">${format_currency(purchaseReturnsRow.amount)}</div>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px; border-bottom: 1px solid #eee; padding-bottom: 5px;">
                <div style="font-weight: bold; text-align: right;">ضريبة المرتجعات:</div>
                <div style="direction: ltr; color: #e74c3c;">${format_currency(purchaseReturnsRow.tax_amount)}</div>
            </div>
            <hr style="border-top: 1px solid #eee; margin: 10px 0;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                <div style="font-weight: bold; text-align: right;">صافي المشتريات:</div>
                <div style="direction: ltr; font-weight: bold;">${format_currency(purchaseNetRow.amount)}</div>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                <div style="font-weight: bold; text-align: right;">صافي ضريبة المشتريات:</div>
                <div style="direction: ltr; color: #2980b9; font-weight: bold;">${format_currency(purchaseNetRow.tax_amount)}</div>
            </div>
        </div>
    </div>
    `;

	var expensesPanel = `
    <div style="width: 100%; clear: both; margin-top: 15px; border: 1px solid #ddd; border-radius: 4px; overflow: hidden; background-color: #fdf9ff;">
        <div style="background-color: #8e44ad; color: white; padding: 10px; text-align: center; font-weight: bold; border-bottom: 1px solid #ddd;">
            المصروفات
        </div>
        <div style="padding: 15px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px; border-bottom: 1px solid #eee; padding-bottom: 5px;">
                <div style="font-weight: bold; text-align: right;">ضريبة المصروفات (القيود اليومية):</div>
                <div style="direction: ltr; color: #8e44ad;">${format_currency(expensesJERow ? expensesJERow.tax_amount : 0)}</div>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px; border-bottom: 1px solid #eee; padding-bottom: 5px;">
                <div style="font-weight: bold; text-align: right;">ضريبة المصروفات (سندات الصرف):</div>
                <div style="direction: ltr; color: #8e44ad;">${format_currency(expensesPERow ? expensesPERow.tax_amount : 0)}</div>
            </div>
            <hr style="border-top: 1px solid #eee; margin: 10px 0;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                <div style="font-weight: bold; text-align: right;">اجمالي الضريبة المستردة:</div>
                <div style="direction: ltr; color: #2980b9; font-weight: bold;">${format_currency(totalRecoverableRow.tax_amount)}</div>
            </div>
        </div>
    </div>
    `;

	var vatDueBox = `
    <div style="clear: both; margin-top: 15px; padding: 15px; text-align: center; border: 2px solid ${parseFloat(vatDueRow.tax_amount) < 0 ? "#e74c3c" : "#27ae60"}; border-radius: 4px; background-color: ${parseFloat(vatDueRow.tax_amount) < 0 ? "#fff5f5" : "#f0fff4"};">
        <div style="font-weight: bold; font-size: 18px;">الفرق الضريبي المستحق:</div>
        <div style="font-weight: bold; font-size: 22px; margin-top: 5px; color: ${parseFloat(vatDueRow.tax_amount) < 0 ? "#e74c3c" : "#27ae60"};">${format_currency(vatDueRow.tax_amount)}</div>
    </div>
    `;

	// إعداد صفوف جدول التفاصيل - استبعاد الصفوف الفرعية
	var detailRows = data
		.filter((row) => row.description && !row.description.startsWith("---")) // استبعاد صفوف العناوين
		.map(function (row) {
			// تطبيق تنسيق خاص على صفوف المجاميع
			var rowStyle = "";
			if (
				row.description &&
				(row.description.includes("اجمالي") || row.description.includes("صافي"))
			) {
				rowStyle = "font-weight: bold; background-color: #f8fafc;";
			}
			if (
				row.description ===
				"اجمالي ضريبة القيمة المضافة المستحقة عن الفترة الضريبية الحالية"
			) {
				rowStyle =
					"font-weight: bold; background-color: #f1f5f9; border-top: 2px solid #cbd5e1; border-bottom: 2px solid #cbd5e1;";
			}
			if (row.description && row.description.includes("المصروفات")) {
				rowStyle = "background-color: #f9f4fc;";
			}
			if (row.description && row.description.includes("مرتجعات")) {
				rowStyle = "background-color: #fff5f5;";
			}
			if (row.description && row.description.includes("غير الخاضعة")) {
				rowStyle = "background-color: #f0f8ff;";
			}

			return `
                <tr style="${rowStyle}">
                    <td style="font-size: 16px; border: 1px solid #ddd; padding: 8px;">${row.description || ""}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: left;">${row.amount !== "" ? format_currency(row.amount) : ""}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: left;">${row.adjustments !== "" ? format_currency(row.adjustments) : ""}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: left;">${row.net_amount !== "" ? format_currency(row.net_amount) : ""}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: left;">${row.tax_amount !== "" ? format_currency(row.tax_amount) : ""}</td>
                </tr>
            `;
		})
		.join("");

	var html = `
    <!DOCTYPE html>
    <html dir="rtl">
    <head>
        <meta charset="UTF-8">
        <title>نموذج الإقرار الضريبي</title>
        <style>
            body { 
                font-family: Arial, sans-serif; 
                margin: 20px; 
                direction: rtl;
                color: #333;
            }
            table { 
                width: 100%; 
                border-collapse: collapse; 
                margin-bottom: 20px; 
                font-size: 15px;
            }
            th, td { 
                border: 1px solid #ddd; 
                padding: 10px; 
                text-align: center; 
            }
            th { 
                background-color: #f5f7fa; 
                font-weight: bold;
                font-size: 16px;
                color: #34495e;
            }
            .header { 
                text-align: center; 
                background-color: #f8f8f8; 
                padding: 15px; 
                margin-bottom: 15px; 
                border: 1px solid #ddd;
                border-radius: 5px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.05);
            }
            .report-title {
                font-size: 20px;
                font-weight: bold;
                margin: 0;
                color: #2c3e50;
            }
            .meta-info {
                display: flex;
                justify-content: space-between;
                margin-bottom: 10px;
                font-size: 14px;
                color: #7f8c8d;
            }
            .filter-info {
                display: flex;
                flex-wrap: wrap;
                gap: 20px;
                margin-bottom: 20px;
                font-size: 14px;
                background-color: #f9f9f9;
                border: 1px solid #eee;
                border-radius: 5px;
                padding: 15px;
            }
            .filter-item {
                flex: 1;
                min-width: 200px;
                margin-bottom: 10px;
            }
            .filter-label {
                font-weight: bold;
                margin-bottom: 5px;
                color: #34495e;
            }
            .filter-value {
                padding: 5px;
                background-color: #f5f5f5;
                border: 1px solid #eee;
                border-radius: 3px;
            }
            .clearfix:after {
                content: "";
                display: table;
                clear: both;
            }
            .details-title {
                margin-top: 30px;
                margin-bottom: 15px;
                text-align: center;
                border-bottom: 2px solid #ddd;
                padding-bottom: 10px;
                font-size: 18px;
                color: #2c3e50;
            }
            .signature-section {
                margin-top: 50px;
                padding-top: 20px;
                border-top: 1px solid #ddd;
            }
            .signatures {
                display: flex;
                justify-content: space-between;
                margin-bottom: 100px;
            }
            .signature-box {
                text-align: center;
                width: 30%;
            }
            .signature-label {
                font-weight: bold;
                margin-bottom: 5px;
                color: #2c3e50;
            }
            .signature-line {
                border-top: 1px solid #000;
                padding-top: 5px;
            }
            .details-section {
                margin-top: 30px;
                border: 1px solid #eee;
                border-radius: 5px;
                overflow: hidden;
                box-shadow: 0 2px 4px rgba(0,0,0,0.05);
            }
            .details-header {
                background-color: #f5f5f5;
                padding: 10px;
                text-align: center;
                font-weight: bold;
                border-bottom: 1px solid #ddd;
                color: #2c3e50;
            }
            @media print {
                body { 
                    font-size: 12pt; 
                    color: #000;
                }
                .no-print {
                    display: none;
                }
                .header, .filter-info, .details-section, table {
                    page-break-inside: avoid;
                }
            }
        </style>
    </head>
    <body>
        <div class="meta-info">
            <div>
                التاريخ: ${formatDate(currentDate)}
            </div>
            <div>
                الوقت: ${currentTime}
            </div>
        </div>
        
        <div class="header">
            <div class="report-title">نموذج الإقرار الضريبي</div>
        </div>
        
        <div class="filter-info">
            <div class="filter-item">
                <div class="filter-label">الشركة:</div>
                <div class="filter-value">${filters.company || ""}</div>
            </div>
            ${
				filters.cost_center
					? `
            <div class="filter-item">
                <div class="filter-label">مركز التكلفة:</div>
                <div class="filter-value">${filters.cost_center || ""}</div>
            </div>
            `
					: ""
			}
            <div class="filter-item">
                <div class="filter-label">الفترة:</div>
                <div class="filter-value">من ${formatDate(filters.from_date)} إلى ${formatDate(filters.to_date)}</div>
            </div>
            ${
				filters.tax_account
					? `
            <div class="filter-item">
                <div class="filter-label">حساب الضريبة:</div>
                <div class="filter-value">${filters.tax_account || ""}</div>
            </div>
            `
					: ""
			}
        </div>
        
        <!-- الأقسام الثلاثة بالتنسيق الجديد -->
        <div class="clearfix">
            ${salesPanel}
            ${purchasePanel}
            ${expensesPanel}
            ${vatDueBox}
        </div>
        
        <div class="details-section">
            <div class="details-header">تفاصيل الإقرار الضريبي</div>
            
            <table class="details-table">
                <thead>
                    <tr>
                        <th style="width: 40%;">البيان</th>
                        <th>المبلغ</th>
                        <th>التعديلات</th>
                        <th>الصافي</th>
                        <th>قيمة ضريبة القيمة المضافة</th>
                    </tr>
                </thead>
                <tbody>
                    ${detailRows}
                </tbody>
            </table>
        </div>
        
        <div class="signature-section">
            <div class="signatures">
                <div class="signature-box">
                    <div class="signature-label">إعداد</div>
                    <div class="signature-line">التوقيع</div>
                </div>
                <div class="signature-box">
                    <div class="signature-label">المراجعة</div>
                    <div class="signature-line">التوقيع</div>
                </div>
                <div class="signature-box">
                    <div class="signature-label">الاعتماد</div>
                    <div class="signature-line">التوقيع</div>
                </div>
            </div>
        </div>
        
        <div class="no-print" style="text-align: center; margin-top: 20px;">
            <button onClick="window.print()" style="padding: 10px 20px; background-color: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px;">طباعة النموذج</button>
        </div>
    </body>
    </html>
    `;

	return html;
}

// دالة التصدير إلى CSV
function downloadCSV(data, filename) {
	var csvContent = "data:text/csv;charset=utf-8,\ufeff"; // إضافة BOM للدعم العربي

	// إعداد العناوين
	var headers = ["البيان", "المبلغ", "التعديلات", "الصافي", "قيمة ضريبة القيمة المضافة"];
	csvContent += headers.join(",") + "\r\n";

	// إضافة البيانات
	data.forEach(function (row) {
		// تخطي صفوف العناوين
		if (row.description && !row.description.startsWith("---")) {
			var rowData = [
				'"' + (row.description || "") + '"', // إضافة علامات اقتباس لمنع مشاكل الفواصل في النص العربي
				row.amount
					? format_currency(row.amount, frappe.defaults.get_default("currency"))
					: "",
				row.adjustments
					? format_currency(row.adjustments, frappe.defaults.get_default("currency"))
					: "",
				row.net_amount
					? format_currency(row.net_amount, frappe.defaults.get_default("currency"))
					: "",
				row.tax_amount
					? format_currency(row.tax_amount, frappe.defaults.get_default("currency"))
					: "",
			];

			csvContent += rowData.join(",") + "\r\n";
		}
	});

	// تصدير الملف
	var encodedUri = encodeURI(csvContent);
	var link = document.createElement("a");
	link.setAttribute("href", encodedUri);
	link.setAttribute("download", filename);
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
}

// دالة لتحديث ملخص الضرائب
function updateTaxSummary(data) {
	// البحث عن الصفوف المطلوبة في البيانات باستخدام الوصف
	var findRow = function (description) {
		return data.find((row) => row.description === description);
	};

	// الحصول على بيانات الصفوف المهمة
	var taxableSales = findRow("المبيعات الخاضعة للنسبة الأساسية");
	var nonTaxableSales = findRow("المبيعات غير الخاضعة أو الضريبة الصفرية");
	var totalSales = findRow("اجمالي المبيعات");
	var salesReturns = findRow("مرتجعات المبيعات الخاضعة للنسبة الأساسية");
	var nonTaxableSalesReturns = findRow("مرتجعات المبيعات غير الخاضعة للضريبة");
	var totalSalesReturns = findRow("اجمالي مرتجعات المبيعات");
	var salesNet = findRow("صافي المبيعات (بعد خصم المرتجعات)");

	var taxablePurchases = findRow("المشتريات الخاضعة للنسبة الأساسية");
	var nonTaxablePurchases = findRow("المشتريات غير الخاضعة أو الضريبة الصفرية");
	var totalPurchases = findRow("اجمالي المشتريات");
	var purchaseReturns = findRow("مرتجعات المشتريات الخاضعة للنسبة الأساسية");
	var nonTaxablePurchaseReturns = findRow("مرتجعات المشتريات غير الخاضعة للضريبة");
	var totalPurchaseReturns = findRow("اجمالي مرتجعات المشتريات");
	var purchaseNet = findRow("صافي المشتريات (بعد خصم المرتجعات)");

	var journalEntries = findRow("المصروفات (القيود اليومية)");
	var paymentEntries = findRow("المصروفات (سندات الصرف)");
	var totalRecoverable = findRow("اجمالي الضريبة المستردة (المشتريات والمصروفات)");

	var vatDue = findRow("اجمالي ضريبة القيمة المضافة المستحقة عن الفترة الضريبية الحالية");

	// إنشاء القسم
	var $taxSummarySection = $(".tax-summary-section");
	$taxSummarySection.empty();

	// صناعة جدول منظم
	var tableHtml = `
    <div class="tax-summary-header" style="background-color: #f5f7fa; padding: 15px; border-bottom: 1px solid #e0e0e0; text-align: center; margin-bottom: 10px;">
        <h3 style="margin: 0; color: #2c3e50; font-size: 18px; font-weight: bold;">ملخص الإقرار الضريبي</h3>
    </div>
    
    <div class="tax-declaration-tables" style="padding: 0 15px;">
        <!-- جدول المبيعات -->
        <div class="table-section" style="margin-bottom: 20px;">
            <div class="table-header" style="background-color: #27ae60; color: white; padding: 8px 15px; font-weight: bold; border-radius: 5px 5px 0 0; text-align: center;">
                المبيعات
            </div>
            <table class="table table-bordered" style="width: 100%; border-collapse: collapse; direction: rtl;">
                <thead>
                    <tr style="background-color: #f8f9fa;">
                        <th style="padding: 10px; text-align: right; border: 1px solid #ddd; width: 60%;">البيان</th>
                        <th style="padding: 10px; text-align: center; border: 1px solid #ddd; width: 20%;">المبلغ</th>
                        <th style="padding: 10px; text-align: center; border: 1px solid #ddd; width: 20%;">الضريبة</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td style="padding: 8px; text-align: right; border: 1px solid #ddd;">المبيعات الخاضعة للضريبة</td>
                        <td style="padding: 8px; text-align: left; border: 1px solid #ddd; direction: ltr;">${format_currency(taxableSales?.amount || 0)}</td>
                        <td style="padding: 8px; text-align: left; border: 1px solid #ddd; direction: ltr; color: #27ae60;">${format_currency(taxableSales?.tax_amount || 0)}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; text-align: right; border: 1px solid #ddd;">المبيعات غير الخاضعة للضريبة</td>
                        <td style="padding: 8px; text-align: left; border: 1px solid #ddd; direction: ltr;">${format_currency(nonTaxableSales?.amount || 0)}</td>
                        <td style="padding: 8px; text-align: left; border: 1px solid #ddd; direction: ltr;">-</td>
                    </tr>
                    <tr style="background-color: #f8fafc;">
                        <td style="padding: 8px; text-align: right; border: 1px solid #ddd; font-weight: bold;">اجمالي المبيعات</td>
                        <td style="padding: 8px; text-align: left; border: 1px solid #ddd; direction: ltr; font-weight: bold;">${format_currency(totalSales?.amount || 0)}</td>
                        <td style="padding: 8px; text-align: left; border: 1px solid #ddd; direction: ltr; font-weight: bold;">${format_currency(totalSales?.tax_amount || 0)}</td>
                    </tr>
                    <tr style="background-color: #fff5f5;">
                        <td style="padding: 8px; text-align: right; border: 1px solid #ddd;">مرتجعات المبيعات الخاضعة للضريبة</td>
                        <td style="padding: 8px; text-align: left; border: 1px solid #ddd; direction: ltr; color: #e74c3c;">${format_currency(salesReturns?.amount || 0)}</td>
                        <td style="padding: 8px; text-align: left; border: 1px solid #ddd; direction: ltr; color: #e74c3c;">${format_currency(salesReturns?.tax_amount || 0)}</td>
                    </tr>
                    <tr style="background-color: #fff5f5;">
                        <td style="padding: 8px; text-align: right; border: 1px solid #ddd;">مرتجعات المبيعات غير الخاضعة للضريبة</td>
                        <td style="padding: 8px; text-align: left; border: 1px solid #ddd; direction: ltr; color: #e74c3c;">${format_currency(nonTaxableSalesReturns?.amount || 0)}</td>
                        <td style="padding: 8px; text-align: left; border: 1px solid #ddd; direction: ltr;">-</td>
                    </tr>
                    <tr style="background-color: #fff5f5;">
                        <td style="padding: 8px; text-align: right; border: 1px solid #ddd; font-weight: bold;">اجمالي مرتجعات المبيعات</td>
                        <td style="padding: 8px; text-align: left; border: 1px solid #ddd; direction: ltr; color: #e74c3c; font-weight: bold;">${format_currency(totalSalesReturns?.amount || 0)}</td>
                        <td style="padding: 8px; text-align: left; border: 1px solid #ddd; direction: ltr; color: #e74c3c; font-weight: bold;">${format_currency(totalSalesReturns?.tax_amount || 0)}</td>
                    </tr>
                    <tr style="background-color: #edf7ed;">
                        <td style="padding: 8px; text-align: right; border: 1px solid #ddd; font-weight: bold;">صافي المبيعات (بعد خصم المرتجعات)</td>
                        <td style="padding: 8px; text-align: left; border: 1px solid #ddd; direction: ltr; font-weight: bold;">${format_currency(salesNet?.amount || 0)}</td>
                        <td style="padding: 8px; text-align: left; border: 1px solid #ddd; direction: ltr; color: #27ae60; font-weight: bold;">${format_currency(salesNet?.tax_amount || 0)}</td>
                    </tr>
                </tbody>
            </table>
        </div>
        
        <!-- جدول المشتريات -->
        <div class="table-section" style="margin-bottom: 20px;">
            <div class="table-header" style="background-color: #2980b9; color: white; padding: 8px 15px; font-weight: bold; border-radius: 5px 5px 0 0; text-align: center;">
                المشتريات
            </div>
            <table class="table table-bordered" style="width: 100%; border-collapse: collapse; direction: rtl;">
                <thead>
                    <tr style="background-color: #f8f9fa;">
                        <th style="padding: 10px; text-align: right; border: 1px solid #ddd; width: 60%;">البيان</th>
                        <th style="padding: 10px; text-align: center; border: 1px solid #ddd; width: 20%;">المبلغ</th>
                        <th style="padding: 10px; text-align: center; border: 1px solid #ddd; width: 20%;">الضريبة</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td style="padding: 8px; text-align: right; border: 1px solid #ddd;">المشتريات الخاضعة للضريبة</td>
                        <td style="padding: 8px; text-align: left; border: 1px solid #ddd; direction: ltr;">${format_currency(taxablePurchases?.amount || 0)}</td>
                        <td style="padding: 8px; text-align: left; border: 1px solid #ddd; direction: ltr; color: #2980b9;">${format_currency(taxablePurchases?.tax_amount || 0)}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; text-align: right; border: 1px solid #ddd;">المشتريات غير الخاضعة للضريبة</td>
                        <td style="padding: 8px; text-align: left; border: 1px solid #ddd; direction: ltr;">${format_currency(nonTaxablePurchases?.amount || 0)}</td>
                        <td style="padding: 8px; text-align: left; border: 1px solid #ddd; direction: ltr;">-</td>
                    </tr>
                    <tr style="background-color: #f8fafc;">
                        <td style="padding: 8px; text-align: right; border: 1px solid #ddd; font-weight: bold;">اجمالي المشتريات</td>
                        <td style="padding: 8px; text-align: left; border: 1px solid #ddd; direction: ltr; font-weight: bold;">${format_currency(totalPurchases?.amount || 0)}</td>
                        <td style="padding: 8px; text-align: left; border: 1px solid #ddd; direction: ltr; font-weight: bold;">${format_currency(totalPurchases?.tax_amount || 0)}</td>
                    </tr>
                    <tr style="background-color: #fff5f5;">
                        <td style="padding: 8px; text-align: right; border: 1px solid #ddd;">مرتجعات المشتريات الخاضعة للضريبة</td>
                        <td style="padding: 8px; text-align: left; border: 1px solid #ddd; direction: ltr; color: #e74c3c;">${format_currency(purchaseReturns?.amount || 0)}</td>
                        <td style="padding: 8px; text-align: left; border: 1px solid #ddd; direction: ltr; color: #e74c3c;">${format_currency(purchaseReturns?.tax_amount || 0)}</td>
                    </tr>
                    <tr style="background-color: #fff5f5;">
                        <td style="padding: 8px; text-align: right; border: 1px solid #ddd;">مرتجعات المشتريات غير الخاضعة للضريبة</td>
                        <td style="padding: 8px; text-align: left; border: 1px solid #ddd; direction: ltr; color: #e74c3c;">${format_currency(nonTaxablePurchaseReturns?.amount || 0)}</td>
                        <td style="padding: 8px; text-align: left; border: 1px solid #ddd; direction: ltr;">-</td>
                    </tr>
                    <tr style="background-color: #fff5f5;">
                        <td style="padding: 8px; text-align: right; border: 1px solid #ddd; font-weight: bold;">اجمالي مرتجعات المشتريات</td>
                        <td style="padding: 8px; text-align: left; border: 1px solid #ddd; direction: ltr; color: #e74c3c; font-weight: bold;">${format_currency(totalPurchaseReturns?.amount || 0)}</td>
                        <td style="padding: 8px; text-align: left; border: 1px solid #ddd; direction: ltr; color: #e74c3c; font-weight: bold;">${format_currency(totalPurchaseReturns?.tax_amount || 0)}</td>
                    </tr>
                    <tr style="background-color: #edf7ed;">
                        <td style="padding: 8px; text-align: right; border: 1px solid #ddd; font-weight: bold;">صافي المشتريات (بعد خصم المرتجعات)</td>
                        <td style="padding: 8px; text-align: left; border: 1px solid #ddd; direction: ltr; font-weight: bold;">${format_currency(purchaseNet?.amount || 0)}</td>
                        <td style="padding: 8px; text-align: left; border: 1px solid #ddd; direction: ltr; color: #2980b9; font-weight: bold;">${format_currency(purchaseNet?.tax_amount || 0)}</td>
                    </tr>
                </tbody>
            </table>
        </div>
        
        <!-- جدول المصروفات -->
        <div class="table-section" style="margin-bottom: 20px;">
            <div class="table-header" style="background-color: #8e44ad; color: white; padding: 8px 15px; font-weight: bold; border-radius: 5px 5px 0 0; text-align: center;">
                المصروفات
            </div>
            <table class="table table-bordered" style="width: 100%; border-collapse: collapse; direction: rtl;">
                <thead>
                    <tr style="background-color: #f8f9fa;">
                        <th style="padding: 10px; text-align: right; border: 1px solid #ddd; width: 60%;">البيان</th>
                        <th style="padding: 10px; text-align: center; border: 1px solid #ddd; width: 20%;">المبلغ</th>
                        <th style="padding: 10px; text-align: center; border: 1px solid #ddd; width: 20%;">الضريبة</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td style="padding: 8px; text-align: right; border: 1px solid #ddd;">المصروفات (القيود اليومية)</td>
                        <td style="padding: 8px; text-align: left; border: 1px solid #ddd; direction: ltr;">${format_currency(journalEntries?.amount || 0)}</td>
                        <td style="padding: 8px; text-align: left; border: 1px solid #ddd; direction: ltr; color: #8e44ad;">${format_currency(journalEntries?.tax_amount || 0)}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; text-align: right; border: 1px solid #ddd;">المصروفات (سندات الصرف)</td>
                        <td style="padding: 8px; text-align: left; border: 1px solid #ddd; direction: ltr;">${format_currency(paymentEntries?.amount || 0)}</td>
                        <td style="padding: 8px; text-align: left; border: 1px solid #ddd; direction: ltr; color: #8e44ad;">${format_currency(paymentEntries?.tax_amount || 0)}</td>
                    </tr>
                    <tr style="background-color: #f5f0f9;">
                        <td style="padding: 8px; text-align: right; border: 1px solid #ddd; font-weight: bold;">اجمالي الضريبة المستردة (المشتريات والمصروفات)</td>
                        <td style="padding: 8px; text-align: left; border: 1px solid #ddd; direction: ltr; font-weight: bold;">${format_currency(totalRecoverable?.amount || 0)}</td>
                        <td style="padding: 8px; text-align: left; border: 1px solid #ddd; direction: ltr; color: #2980b9; font-weight: bold;">${format_currency(totalRecoverable?.tax_amount || 0)}</td>
                    </tr>
                </tbody>
            </table>
        </div>
        
        <!-- مربع الفرق الضريبي -->
        <div class="tax-due-container" style="margin: 20px 0; padding: 15px; text-align: center; border: 2px solid ${vatDue && parseFloat(vatDue.tax_amount) < 0 ? "#e74c3c" : "#27ae60"}; border-radius: 4px; background-color: ${vatDue && parseFloat(vatDue.tax_amount) < 0 ? "#fff5f5" : "#f0fff4"};">
            <div style="font-weight: bold; font-size: 18px; margin-bottom: 10px;">الفرق الضريبي المستحق عن الفترة الضريبية الحالية</div>
            <div style="font-weight: bold; font-size: 24px; color: ${vatDue && parseFloat(vatDue.tax_amount) < 0 ? "#e74c3c" : "#27ae60"};">${format_currency(vatDue?.tax_amount || 0)}</div>
        </div>
    </div>
    `;

	// إضافة الجدول إلى القسم
	$taxSummarySection.html(tableHtml);
}
