// Copyright (c) 2026, Mohamed AbdElsabour and contributors
// For license information, please see license.txt

frappe.query_reports["Supplier Statement Report"] = {
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
			fieldname: "supplier",
			label: __("المورد"),
			fieldtype: "Link",
			options: "Supplier",
			reqd: 1,
			width: "200px",
			get_query: function () {
				return {
					filters: [["Supplier", "disabled", "=", 0]],
				};
			},
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
			fieldname: "include_cancelled",
			label: __("تضمين المستندات الملغاة"),
			fieldtype: "Check",
			default: 0,
		},
	],
	formatter: function (value, row, column, data, default_formatter) {
		if (data) {
			// تنسيق عمود نوع المستند - ترجمة الأنواع إلى العربية
			if (column.fieldname === "voucher_type") {
				switch (value) {
					case "Purchase Invoice":
						return "فاتورة مشتريات";
					case "Payment Entry":
						return "سند دفع";
					case "Journal Entry":
						return "قيد محاسبي";
					case "Sales Invoice":
						return "فاتورة مبيعات";
					case "Opening Balance":
						return "الرصيد الافتتاحي";
					default:
						return value;
				}
			}

			// تنسيق لحالة الفاتورة - مع ترميز اللون
			if (column.fieldname === "invoice_status") {
				if (!value) return "";

				let color = "black";
				if (value.includes("مرتجع")) {
					color = "red";
				} else if (value.includes("مسددة بالكامل")) {
					color = "green";
				} else if (value.includes("غير مسددة") || value.includes("متأخرة")) {
					color = "orange";
				} else if (value.includes("مسددة جزئياً")) {
					color = "blue";
				} else if (value.includes("ملغية")) {
					color = "gray";
				}

				return `<span style="color: ${color}; font-weight: bold;">${value}</span>`;
			}

			// تنسيق لعمود الرصيد
			if (column.fieldname === "balance") {
				return (
					'<span style="color: ' +
					(data.balance >= 0 ? "blue" : "red") +
					';">' +
					default_formatter(Math.abs(value), row, column, data) +
					" " +
					(data.balance >= 0 ? "لنا" : "علينا") +
					"</span>"
				);
			}

			// تنسيق أساسي للإجماليات
			if (data.is_total_row) {
				return (
					'<span style="font-weight: bold;">' +
					default_formatter(value, row, column, data) +
					"</span>"
				);
			}
		}

		return default_formatter(value, row, column, data);
	},

	onload: function (report) {
		console.log("تم تحميل تقرير كشف حساب المورد");

		// إضافة CSS مخصص
		$(
			"<style>\
            .datatable .dt-cell { padding: 0px !important; }\
            .datatable .dt-row { border-bottom: 1px solid #eee; }\
            .datatable .dt-header .dt-cell { background-color: #f5f7fa; font-weight: bold; }\
            .supplier-summary-section { direction: rtl; }\
            .balance-card { background-color: #f8f8f8; border-radius: 5px; padding: 15px; margin-bottom: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }\
            .balance-card-title { font-weight: bold; margin-bottom: 10px; font-size: 16px; }\
            .balance-amount { font-size: 20px; font-weight: bold; }\
            .balance-card.debit { border-left: 5px solid #4272d7; }\
            .balance-card.credit { border-left: 5px solid #28a745; }\
            .balance-card.closing { border-left: 5px solid #fd7e14; }\
            .debit-amount { color: #4272d7; }\
            .credit-amount { color: #28a745; }\
            .closing-amount { color: #fd7e14; }\
        </style>",
		).appendTo("head");

		// إضافة زر توليد تقرير جديد
		report.page.add_inner_button(
			__("توليد تقرير جديد"),
			function () {
				report.refresh();
			},
			__("خيارات"),
		);

		// إنشاء قسم ملخص المورد المحسّن
		var $supplierSummarySection = $(
			'<div class="supplier-summary-section" style="margin-bottom: 20px; padding: 20px; background-color: #fff; border: 1px solid #ddd; border-radius: 5px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);"></div>',
		);
		var $supplierSummaryHeader = $(
			'<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 2px solid #f0f0f0; padding-bottom: 10px;"><h3 style="margin: 0; color: #333; font-weight: bold;">' +
				__("ملخص حساب المورد") +
				'</h3><div class="report-date"></div></div>',
		);
		var $supplierInfoSection = $(
			'<div class="supplier-info" style="margin-bottom: 20px;"></div>',
		);

		// إنشاء صف جديد لبطاقات الرصيد
		var $balanceCardsSection = $(
			'<div class="balance-cards" style="display: flex; flex-wrap: wrap; gap: 15px; margin-bottom: 15px;"></div>',
		);

		// إنشاء بطاقات الرصيد الفردية
		var $debitCard = $(
			'<div class="balance-card debit" style="flex: 1;"><div class="balance-card-title">' +
				__("إجمالي المدين") +
				'</div><div class="balance-amount debit-amount"></div></div>',
		);
		var $creditCard = $(
			'<div class="balance-card credit" style="flex: 1;"><div class="balance-card-title">' +
				__("إجمالي الدائن") +
				'</div><div class="balance-amount credit-amount"></div></div>',
		);
		var $closingBalanceCard = $(
			'<div class="balance-card closing" style="flex: 1;"><div class="balance-card-title">' +
				__("الرصيد الختامي") +
				'</div><div class="balance-amount closing-amount"></div></div>',
		);

		$balanceCardsSection.append($debitCard).append($creditCard).append($closingBalanceCard);

		// إنشاء قسم ملخص المعاملات
		var $transactionsSummary = $(
			'<div class="transactions-summary" style="margin-top: 20px;"></div>',
		);

		$supplierSummarySection
			.append($supplierSummaryHeader)
			.append($supplierInfoSection)
			.append($balanceCardsSection)
			.append($transactionsSummary);

		// إضافة القسم في أعلى التقرير بعد المرشحات
		if (report.page.main.find(".supplier-summary-section").length === 0) {
			report.page.main.find(".report-filter-section").after($supplierSummarySection);
		}

		// تحديث ملخص المورد عند تحميل البيانات
		var originalRefresh = report.refresh;
		report.refresh = function () {
			originalRefresh.call(this);

			// التأكد من توفر البيانات
			if (report.data && report.data.length > 0) {
				updateSupplierSummary(report.data, report.get_values());
			}
		};

		// دالة تحديث ملخص المورد - تصميم محسّن
		function updateSupplierSummary(data, filters) {
			// تحديث تاريخ التقرير
			$(".report-date").html(
				`<span style="font-size: 14px;">${__("تاريخ التقرير")}: ${formatDate(frappe.datetime.get_today())}</span>`,
			);

			// الحصول على بيانات المورد مع مزيد من التفاصيل
			frappe.db.get_value(
				"Supplier",
				filters.supplier,
				["supplier_name", "supplier_group", "supplier_type", "tax_id", "payment_terms"],
				function (r) {
					if (r) {
						// تحديث معلومات المورد بتصميم محسّن
						$(".supplier-info").empty();
						$(".supplier-info").append(`
                            <div style="display: flex; flex-wrap: wrap; gap: 15px;">
                                <div style="flex: 1 0 300px; background-color: #f8f8f8; padding: 15px; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                                    <table style="width: 100%;">
                                        <tr>
                                            <td style="padding: 5px 10px 5px 0; font-weight: bold; color: #666;">${__("كود المورد")}</td>
                                            <td style="padding: 5px 0; font-weight: bold;">${filters.supplier}</td>
                                        </tr>
                                        <tr>
                                            <td style="padding: 5px 10px 5px 0; font-weight: bold; color: #666;">${__("اسم المورد")}</td>
                                            <td style="padding: 5px 0;">${r.supplier_name || filters.supplier}</td>
                                        </tr>
                                        <tr>
                                            <td style="padding: 5px 10px 5px 0; font-weight: bold; color: #666;">${__("مجموعة المورد")}</td>
                                            <td style="padding: 5px 0;">${r.supplier_group || ""}</td>
                                        </tr>
                                        <tr>
                                            <td style="padding: 5px 10px 5px 0; font-weight: bold; color: #666;">${__("الرقم الضريبي")}</td>
                                            <td style="padding: 5px 0;">${r.tax_id || ""}</td>
                                        </tr>
                                    </table>
                                </div>
                                <div style="flex: 1 0 300px; background-color: #f8f8f8; padding: 15px; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                                    <table style="width: 100%;">
                                        <tr>
                                            <td style="padding: 5px 10px 5px 0; font-weight: bold; color: #666;">${__("نوع المورد")}</td>
                                            <td style="padding: 5px 0;">${r.supplier_type || ""}</td>
                                        </tr>
                                        <tr>
                                            <td style="padding: 5px 10px 5px 0; font-weight: bold; color: #666;">${__("شروط الدفع")}</td>
                                            <td style="padding: 5px 0;">${r.payment_terms || ""}</td>
                                        </tr>
                                        <tr>
                                            <td style="padding: 5px 10px 5px 0; font-weight: bold; color: #666;">${__("الفترة")}</td>
                                            <td style="padding: 5px 0;">${formatDate(filters.from_date)} - ${formatDate(filters.to_date)}</td>
                                        </tr>
                                    </table>
                                </div>
                            </div>
                        `);
					}
				},
			);

			// البحث عن صفوف الرصيد الافتتاحي والختامي
			var openingBalanceRow = data.find((row) => row.voucher_type === "Opening Balance");
			var closingBalanceRow = data[data.length - 1]; // آخر صف يمثل الرصيد الختامي

			// حساب إجماليات المدين والدائن
			var totalDebit = 0;
			var totalCredit = 0;

			data.forEach(function (row) {
				if (!row.is_total_row && row.voucher_type !== "Opening Balance") {
					totalDebit += flt(row.debit);
					totalCredit += flt(row.credit);
				}
			});

			// تحديث بطاقات الرصيد
			$(".debit-amount").text(format_currency(totalDebit));
			$(".credit-amount").text(format_currency(totalCredit));

			// تحديث الرصيد الختامي مع إشارة إلى ما إذا كان لنا أو علينا
			var closingBalance = closingBalanceRow ? closingBalanceRow.balance : 0;
			var closingBalanceText =
				format_currency(Math.abs(closingBalance)) +
				" " +
				(closingBalance >= 0 ? __("لنا") : __("علينا"));
			$(".closing-amount").text(closingBalanceText);

			// تحديث ملخص المعاملات
			$(".transactions-summary").empty();

			// الحصول على عدد أنواع المعاملات المختلفة
			var invoiceCount = 0;
			var paymentCount = 0;
			var returnCount = 0;
			var otherCount = 0;

			data.forEach(function (row) {
				if (!row.is_total_row && row.voucher_type !== "Opening Balance") {
					if (row.voucher_type === "Purchase Invoice") {
						if (row.invoice_status && row.invoice_status.includes("مرتجع")) {
							returnCount++;
						} else {
							invoiceCount++;
						}
					} else if (row.voucher_type === "Payment Entry") {
						paymentCount++;
					} else {
						otherCount++;
					}
				}
			});

			// إضافة بطاقات ملخص المعاملات
			$(".transactions-summary").append(`
                <div style="margin-top: 20px;">
                    <h4 style="margin-bottom: 15px; color: #333; font-weight: bold;">${__("ملخص المعاملات")}</h4>
                    <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                        <div style="flex: 1 0 150px; background-color: #eaf4ff; padding: 15px; border-radius: 5px; text-align: center; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                            <div style="font-size: 24px; font-weight: bold; color: #4272d7;">${invoiceCount}</div>
                            <div style="color: #666;">${__("فواتير مشتريات")}</div>
                        </div>
                        <div style="flex: 1 0 150px; background-color: #e8f5e9; padding: 15px; border-radius: 5px; text-align: center; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                            <div style="font-size: 24px; font-weight: bold; color: #28a745;">${paymentCount}</div>
                            <div style="color: #666;">${__("سندات دفع")}</div>
                        </div>
                        <div style="flex: 1 0 150px; background-color: #fff3e0; padding: 15px; border-radius: 5px; text-align: center; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                            <div style="font-size: 24px; font-weight: bold; color: #fd7e14;">${returnCount}</div>
                            <div style="color: #666;">${__("مرتجعات")}</div>
                        </div>
                        <div style="flex: 1 0 150px; background-color: #f5f5f5; padding: 15px; border-radius: 5px; text-align: center; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                            <div style="font-size: 24px; font-weight: bold; color: #6c757d;">${otherCount}</div>
                            <div style="color: #666;">${__("معاملات أخرى")}</div>
                        </div>
                    </div>
                </div>
            `);
		}

		// إضافة زر رئيسي لتوليد التقرير
		const generateButton = $(`<button class="btn btn-primary btn-sm primary-action">
            ${__("توليد التقرير")}
        </button>`);

		generateButton.on("click", function () {
			report.refresh();
		});

		// إضافة الزر في أعلى التقرير
		if (report.page.main.find(".custom-generate-button").length === 0) {
			report.page.main.find(".report-filter-section").find(".flex").append(generateButton);
			generateButton.addClass("custom-generate-button");
		}

		// إضافة زر الطباعة
		report.page.add_inner_button(__("طباعة كشف الحساب"), function () {
			if (report.data && report.data.length > 0) {
				var data = report.data;
				var filters = report.get_values();

				// عرض رسالة الانتظار أثناء تجهيز التقرير
				frappe.show_alert({
					message: __("جاري تجهيز التقرير للطباعة..."),
					indicator: "blue",
				});

				// استخدام then بدلاً من إرجاع الوعد مباشرة
				createSupplierStatementForm(data, filters)
					.then(function (html) {
						// فتح نافذة جديدة وعرض النموذج بعد اكتمال الوعد
						var w = window.open();
						if (w) {
							w.document.write(html);
							w.document.close();
							setTimeout(function () {
								w.print();
							}, 1000);
						} else {
							frappe.msgprint(
								__(
									"تم حظر النوافذ المنبثقة. يرجى السماح بالنوافذ المنبثقة لطباعة التقرير.",
								),
							);
						}
					})
					.catch(function (error) {
						frappe.msgprint(__("حدث خطأ أثناء إعداد التقرير للطباعة: ") + error);
						console.error(error);
					});
			} else {
				frappe.msgprint(__("لا توجد بيانات لعرضها. يرجى التحقق من المرشحات."));
			}
		});

		// إضافة زر التصدير
		report.page.add_inner_button(__("تصدير"), function () {
			if (report.data && report.data.length > 0) {
				var data = report.data;
				var filters = report.get_values();

				downloadCSV(
					data,
					"supplier_statement_" +
						filters.supplier +
						"_" +
						filters.from_date +
						"_to_" +
						filters.to_date +
						".csv",
				);
			} else {
				frappe.msgprint(__("لا توجد بيانات للتصدير"));
			}
		});
	},

	initial_setup: true, // ضمان تحميل المرشحات عند فتح التقرير
	show_filters_on_top: true, // عرض المرشحات في الأعلى
};

// وظيفة طباعة كشف حساب المورد المبسطة مع تصحيح عرض عمود الرصيد
function createSupplierStatementForm(data, filters) {
	return new Promise(function (resolve, reject) {
		try {
			// الحصول على معلومات الشركة
			frappe.db.get_value(
				"Company",
				filters.company,
				["company_name", "tax_id"],
				function (companyInfo) {
					// الحصول على معلومات المورد
					frappe.db.get_value(
						"Supplier",
						filters.supplier,
						["supplier_name", "tax_id"],
						function (supplierInfo) {
							// البحث عن صفوف الرصيد الافتتاحي والختامي
							var openingBalanceRow = data.find(
								(row) => row.voucher_type === "Opening Balance",
							);
							var closingBalanceRow = data[data.length - 1]; // آخر صف يمثل الرصيد الختامي

							// حساب المجاميع
							var totalDebit = 0;
							var totalCredit = 0;

							data.forEach(function (row) {
								if (!row.is_total_row && row.voucher_type !== "Opening Balance") {
									totalDebit += flt(row.debit);
									totalCredit += flt(row.credit);
								}
							});

							// إنشاء صفوف جدول المعاملات
							var transactionRows = [];

							// دالة لإضافة أيام إلى تاريخ
							function add_days(dateStr, days) {
								var date = new Date(dateStr);
								date.setDate(date.getDate() + days);
								return date.toISOString().split("T")[0];
							}

							// أضف الرصيد الافتتاحي كأول صف
							var openingBalance = openingBalanceRow ? openingBalanceRow.balance : 0;
							transactionRows.push(`
                        <tr>
                            <td>${formatDate(openingBalanceRow ? openingBalanceRow.posting_date : add_days(filters.from_date, -1))}</td>
                            <td>-</td>
                            <td>الرصيد الافتتاحي</td>
                            <td>الرصيد الافتتاحي</td>
                            <td></td>
                            <td>${openingBalance > 0 ? format_currency(Math.abs(openingBalance)) : ""}</td>
                            <td>${openingBalance < 0 ? format_currency(Math.abs(openingBalance)) : ""}</td>
                            <td class="balance-cell">${format_currency(Math.abs(openingBalance))} ${openingBalance >= 0 ? "لنا" : "علينا"}</td>
                        </tr>
                    `);

							// إضافة صفوف المعاملات
							data.forEach(function (row) {
								if (!row.is_total_row && row.voucher_type !== "Opening Balance") {
									// تحديد نوع المستند بالعربية
									var documentType = "";

									if (row.voucher_type === "Purchase Invoice") {
										if (
											row.invoice_status &&
											row.invoice_status.includes("مرتجع")
										) {
											documentType = "مرتجع مشتريات";
										} else {
											documentType = "فاتورة مشتريات";
										}
									} else if (row.voucher_type === "Payment Entry") {
										documentType = "سند دفع";
									} else if (row.voucher_type === "Journal Entry") {
										documentType = "قيد محاسبي";
									} else {
										documentType = row.voucher_type;
									}

									transactionRows.push(`
                                <tr>
                                    <td>${formatDate(row.posting_date)}</td>
                                    <td>${row.voucher_no || ""}</td>
                                    <td>${documentType}</td>
                                    <td>${row.description || ""}</td>
                                    <td>${row.invoice_status || ""}</td>
                                    <td>${row.debit > 0 ? format_currency(row.debit) : ""}</td>
                                    <td>${row.credit > 0 ? format_currency(row.credit) : ""}</td>
                                    <td class="balance-cell">${format_currency(Math.abs(row.balance))} ${row.balance >= 0 ? "لنا" : "علينا"}</td>
                                </tr>
                            `);
								}
							});

							// بناء قالب HTML للطباعة البسيطة مُحسّن لورق A4
							var currentDate = frappe.datetime.get_today();

							var html = `
                    <!DOCTYPE html>
                    <html dir="rtl">
                    <head>
                        <meta charset="UTF-8">
                        <title>كشف حساب المورد - ${supplierInfo.supplier_name || filters.supplier}</title>
                        <style>
                            @page {
                                size: A4;
                                margin: 0.5cm;
                            }
                            body { 
                                font-family: Arial, sans-serif; 
                                margin: 0; 
                                padding: 0;
                                direction: rtl;
                                font-size: 11px;
                                width: 100%;
                                box-sizing: border-box;
                                page-break-after: avoid;
                            }
                            .company-info {
                                text-align: center;
                                margin-bottom: 5px;
                                padding: 5px;
                                border-bottom: 1px solid #000;
                            }
                            .company-info h3 {
                                margin: 5px 0;
                                font-size: 16px;
                            }
                            table { 
                                width: 100%; 
                                border-collapse: collapse; 
                                margin-bottom: 10px; 
                                table-layout: fixed;
                            }
                            th, td { 
                                border: 1px solid #000; 
                                padding: 3px 2px; 
                                text-align: center;
                                font-size: 10px;
                                overflow: hidden;
                            }
                            .balance-cell {
                                white-space: nowrap;
                                text-align: center;
                                font-size: 10px;
                            }
                            th { 
                                background-color: #f2f2f2; 
                                font-weight: bold;
                                font-size: 10px;
                            }
                            .report-title {
                                text-align: center;
                                margin: 5px 0;
                                font-size: 16px;
                                font-weight: bold;
                                border-bottom: 1px solid #000;
                                padding-bottom: 5px;
                            }
                            .totals {
                                display: flex;
                                justify-content: space-between;
                                margin: 10px 0;
                                border-top: 1px solid #000;
                                padding-top: 5px;
                            }
                            .total-box {
                                width: 33%;
                                text-align: center;
                                padding: 5px;
                                border: 1px solid #000;
                                background-color: #f2f2f2;
                            }
                            .footer {
                                text-align: center;
                                margin-top: 5px;
                                font-size: 10px;
                                border-top: 1px solid #000;
                                padding-top: 5px;
                            }
                            .signatures {
                                display: flex;
                                justify-content: space-between;
                                margin-top: 10px;
                            }
                            .signature-box {
                                width: 32%;
                                text-align: center;
                            }
                            .signature-line {
                                border-bottom: 1px solid #000;
                                height: 30px;
                                margin-bottom: 5px;
                            }
                            /* تفعيل الأرقام الإنجليزية */
                            .en-number {
                                font-family: Arial, sans-serif !important;
                                -webkit-font-feature-settings: 'tnum';
                                font-feature-settings: 'tnum';
                                font-variant-numeric: tabular-nums;
                            }
                            @media print {
                                body { 
                                    margin: 0; 
                                    print-color-adjust: exact;
                                    -webkit-print-color-adjust: exact;
                                }
                                .avoid-break {
                                    page-break-inside: avoid;
                                }
                                thead {
                                    display: table-header-group;
                                }
                            }
                        </style>
                    </head>
                    <body>
                        <div class="company-info">
                            <h3>${companyInfo.company_name}</h3>
                            <div>الرقم الضريبي: <span class="en-number">${companyInfo.tax_id || "—"}</span></div>
                        </div>
                        
                        <div class="report-title">
                            كشف حساب المورد / Supplier Statement
                        </div>
                        
                        <table class="info-table">
                            <tr>
                                <td style="width: 15%; background-color: #f2f2f2; font-weight: bold; text-align: left;">مورد / Supplier:</td>
                                <td style="width: 35%;">${supplierInfo.supplier_name || filters.supplier}</td>
                                <td style="width: 15%; background-color: #f2f2f2; font-weight: bold; text-align: left;">الفترة / Period:</td>
                                <td style="width: 35%;" class="en-number">${formatDate(filters.from_date)} - ${formatDate(filters.to_date)}</td>
                            </tr>
                            <tr>
                                <td style="background-color: #f2f2f2; font-weight: bold; text-align: left;">الرقم الضريبي / Tax ID:</td>
                                <td class="en-number">${supplierInfo.tax_id || "—"}</td>
                                <td style="background-color: #f2f2f2; font-weight: bold; text-align: left;">تاريخ التقرير / Report Date:</td>
                                <td class="en-number">${formatDate(currentDate)}</td>
                            </tr>
                        </table>
                        
                        <table class="transactions-table">
                            <thead>
                                <tr>
                                    <th style="width: 9%;">التاريخ<br/>Date</th>
                                    <th style="width: 14%;">رقم المستند<br/>Document No</th>
                                    <th style="width: 10%;">نوع المستند<br/>Type</th>
                                    <th style="width: 18%;">البيان<br/>Description</th>
                                    <th style="width: 11%;">حالة الفاتورة<br/>Status</th>
                                    <th style="width: 11%;">مدين<br/>Debit</th>
                                    <th style="width: 11%;">دائن<br/>Credit</th>
                                    <th style="width: 16%;">الرصيد<br/>Balance</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${transactionRows.join("")}
                            </tbody>
                        </table>
                        
                        <div class="totals avoid-break">
                            <div class="total-box">
                                <div style="font-weight: bold; margin-bottom: 5px;">إجمالي المدين / Debit Total:</div>
                                <div class="en-number">${format_currency(totalDebit)}</div>
                            </div>
                            <div class="total-box">
                                <div style="font-weight: bold; margin-bottom: 5px;">إجمالي الدائن / Credit Total:</div>
                                <div class="en-number">${format_currency(totalCredit)}</div>
                            </div>
                            <div class="total-box">
                                <div style="font-weight: bold; margin-bottom: 5px;">الرصيد الختامي / Closing Balance:</div>
                                <div class="en-number">${format_currency(Math.abs(closingBalanceRow.balance))} ${closingBalanceRow && closingBalanceRow.balance >= 0 ? "لنا / Our" : "علينا / Due"}</div>
                            </div>
                        </div>
                        
                        <div class="signatures avoid-break">
                            <div class="signature-box">
                                <div class="signature-line"></div>
                                <div>توقيع المورد / Supplier Signature</div>
                            </div>
                            <div class="signature-box">
                                <div class="signature-line"></div>
                                <div>المحاسب / Accountant</div>
                            </div>
                            <div class="signature-box">
                                <div class="signature-line"></div>
                                <div>المدير المالي / Financial Manager</div>
                            </div>
                        </div>
                        
                        <div class="footer avoid-break">
                            تم إصدار هذا الكشف بتاريخ <span class="en-number">${formatDate(currentDate)}</span>
                        </div>
                    </body>
                    </html>
                    `;

							resolve(html);
						},
					);
				},
			);
		} catch (error) {
			reject(error);
		}
	});
}

// تحديث دالة تنسيق التاريخ لعرض الأرقام بالإنجليزية
function formatDate(dateStr) {
	if (!dateStr) return "";
	var d = new Date(dateStr);
	var day = d.getDate().toString().padStart(2, "0");
	var month = (d.getMonth() + 1).toString().padStart(2, "0");
	var year = d.getFullYear();
	return day + "/" + month + "/" + year;
}

// دالة تصدير إلى CSV
function downloadCSV(data, filename) {
	var csvContent = "data:text/csv;charset=utf-8,\ufeff"; // إضافة BOM لدعم اللغة العربية

	// تجهيز العناوين
	var headers = [
		"التاريخ",
		"رقم المستند",
		"نوع المستند",
		"البيان",
		"حالة الفاتورة",
		"مدين",
		"دائن",
		"الرصيد",
	];
	csvContent += headers.join(",") + "\r\n";

	// إضافة البيانات
	data.forEach(function (row) {
		if (!row.is_total_row) {
			var rowData = [
				row.posting_date || "",
				'"' + (row.voucher_no || "") + '"',
				'"' + (row.voucher_type || "") + '"',
				'"' + (row.description || "") + '"',
				'"' + (row.invoice_status || "") + '"',
				row.debit || 0,
				row.credit || 0,
				row.balance || 0,
			];

			// تحويل القيم الرقمية إلى نص لتجنب مشكلات الفواصل
			rowData = rowData.map(function (val) {
				if (val === "") return val;
				return typeof val === "number" ? val.toFixed(2) : val;
			});

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
