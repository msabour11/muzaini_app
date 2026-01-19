// Copyright (c) 2026, Mohamed AbdElsabour and contributors
// For license information, please see license.txt

frappe.query_reports["Cash Account Statement Report"] = {
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
			fieldname: "mode_of_payment",
			label: __("طريقة الدفع"),
			fieldtype: "Link",
			options: "Mode of Payment",
			reqd: 1,
			width: "150px",
		},
		{
			fieldname: "from_date",
			label: __("من تاريخ"),
			fieldtype: "Date",
			default: frappe.datetime.add_months(frappe.datetime.get_today(), -1),
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
			fieldname: "user",
			label: __("المستخدم"),
			fieldtype: "Link",
			options: "User",
			width: "150px",
		},
		{
			fieldname: "cost_center",
			label: __("مركز التكلفة"),
			fieldtype: "Link",
			options: "Cost Center",
			width: "150px",
		},
	],
	formatter: function (value, row, column, data, default_formatter) {
		if (data) {
			// نوع المستند يأتي مترجمًا بالفعل من الخادم
			if (column.fieldname === "voucher_type") {
				return value;
			}

			// تنسيق رقم المستند ليكون رابطًا
			if (column.fieldname === "voucher_no" && value && data.voucher_type) {
				// تأكد من أن الرابط صحيح باستخدام نوع المستند الأصلي
				let doctype = getOriginalDocType(data.voucher_type);
				if (doctype) {
					return `<a href="/app/${doctype.toLowerCase().replace(/ /g, "-")}/${value}" target="_blank">${value}</a>`;
				}
			}

			// تنسيق للمبلغ المدين
			if (column.fieldname === "debit_amount") {
				if (value && value > 0) {
					return (
						'<span style="color: green; font-weight: bold;">' +
						default_formatter(value, row, column, data) +
						"</span>"
					);
				}
				return default_formatter(value, row, column, data);
			}

			// تنسيق للمبلغ الدائن
			if (column.fieldname === "credit_amount") {
				if (value && value > 0) {
					return (
						'<span style="color: red; font-weight: bold;">' +
						default_formatter(value, row, column, data) +
						"</span>"
					);
				}
				return default_formatter(value, row, column, data);
			}

			// تنسيق للرصيد
			if (column.fieldname === "running_balance") {
				var color = data.running_balance >= 0 ? "blue" : "red";
				return (
					'<span style="color: ' +
					color +
					'; font-weight: bold;">' +
					default_formatter(value, row, column, data) +
					"</span>"
				);
			}

			// تنسيق أساسي للإجماليات
			if (data.is_total_row) {
				return (
					'<span style="font-weight: bold; background-color: #f8f8f8;">' +
					default_formatter(value, row, column, data) +
					"</span>"
				);
			}
		}

		return default_formatter(value, row, column, data);
	},

	onload: function (report) {
		console.log("تم تحميل تقرير كشف حساب طريقة الدفع");

		// إضافة CSS مخصص
		$(
			"<style>\
            .datatable .dt-cell { padding: 1px 5px !important; }\
            .datatable .dt-row { border-bottom: 1px solid #eee; }\
            .datatable .dt-header .dt-cell { background-color: #f5f7fa; font-weight: bold; }\
            .cash-account-summary-section { direction: rtl; }\
            .summary-card { background-color: #f8f8f8; border-radius: 5px; padding: 15px; margin-bottom: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }\
            .summary-card-title { font-weight: bold; margin-bottom: 10px; font-size: 16px; }\
            .summary-amount { font-size: 20px; font-weight: bold; }\
            .summary-card.total-debit { border-right: 5px solid #28a745; }\
            .summary-card.total-credit { border-right: 5px solid #dc3545; }\
            .summary-card.current-balance { border-right: 5px solid #4272d7; }\
            .debit-amount { color: #28a745; }\
            .credit-amount { color: #dc3545; }\
            .balance-amount { color: #4272d7; }\
        </style>",
		).appendTo("head");

		// إنشاء قسم ملخص الحساب
		var $accountSummarySection = $(
			'<div class="cash-account-summary-section" style="margin-bottom: 20px; padding: 20px; background-color: #fff; border: 1px solid #ddd; border-radius: 5px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);"></div>',
		);
		var $accountSummaryHeader = $(
			'<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 2px solid #f0f0f0; padding-bottom: 10px;"><h3 style="margin: 0; color: #333; font-weight: bold;">' +
				__("ملخص كشف حساب طريقة الدفع") +
				'</h3><div class="report-date"></div></div>',
		);

		// إنشاء صف لبطاقات الملخص
		var $summaryCardsSection = $(
			'<div class="summary-cards" style="display: flex; flex-wrap: wrap; gap: 15px; margin-bottom: 15px;"></div>',
		);

		// إنشاء بطاقات الملخص
		var $debitCard = $(
			'<div class="summary-card total-debit" style="flex: 1;"><div class="summary-card-title">' +
				__("إجمالي المدين") +
				'</div><div class="summary-amount debit-amount"></div></div>',
		);
		var $creditCard = $(
			'<div class="summary-card total-credit" style="flex: 1;"><div class="summary-card-title">' +
				__("إجمالي الدائن") +
				'</div><div class="summary-amount credit-amount"></div></div>',
		);
		var $balanceCard = $(
			'<div class="summary-card current-balance" style="flex: 1;"><div class="summary-card-title">' +
				__("الرصيد الحالي") +
				'</div><div class="summary-amount balance-amount"></div></div>',
		);

		$summaryCardsSection.append($debitCard).append($creditCard).append($balanceCard);

		// إنشاء قسم تفاصيل الحساب
		var $accountDetailsSection = $(
			'<div class="account-details" style="margin-top: 20px;"></div>',
		);

		$accountSummarySection
			.append($accountSummaryHeader)
			.append($summaryCardsSection)
			.append($accountDetailsSection);

		// إضافة القسم في أعلى التقرير بعد المرشحات
		if (report.page.main.find(".cash-account-summary-section").length === 0) {
			report.page.main.find(".report-filter-section").after($accountSummarySection);
		}

		// تحديث ملخص الحساب عند تحميل البيانات
		var originalRefresh = report.refresh;
		report.refresh = function () {
			originalRefresh.call(this);

			// التأكد من توفر البيانات
			if (report.data && report.data.length > 0) {
				updateAccountSummary(report.data, report.get_values());
			}
		};

		// دالة تحديث ملخص الحساب
		function updateAccountSummary(data, filters) {
			// تحديث تاريخ التقرير
			$(".report-date").html(
				`<span style="font-size: 14px;">${__("تاريخ التقرير")}: ${formatDate(frappe.datetime.get_today())}</span>`,
			);

			// حساب الإجماليات
			var totalDebit = 0;
			var totalCredit = 0;
			var finalBalance = 0;

			data.forEach(function (row) {
				if (!row.is_total_row) {
					if (row.debit_amount > 0) {
						totalDebit += flt(row.debit_amount);
					}
					if (row.credit_amount > 0) {
						totalCredit += flt(row.credit_amount);
					}

					// استخدام آخر رصيد في الكشف
					if (row.running_balance !== undefined) {
						finalBalance = flt(row.running_balance);
					}
				}
			});

			// تحديث بطاقات الملخص
			$(".debit-amount").text(format_currency(totalDebit));
			$(".credit-amount").text(format_currency(totalCredit));
			$(".balance-amount").text(format_currency(finalBalance));

			// تحديث تفاصيل الحساب
			$(".account-details").empty();

			// الحصول على اسم طريقة الدفع
			frappe.db.get_value("Mode of Payment", filters.mode_of_payment, "name", function (r) {
				if (r && r.name) {
					$(".account-details").append(`
                        <div style="margin-bottom: 15px;">
                            <strong>${__("طريقة الدفع")}: </strong>${r.name}
                            <br>
                            <strong>${__("الفترة")}: </strong>${formatDate(filters.from_date)} - ${formatDate(filters.to_date)}
                        </div>
                    `);
				}
			});
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

				// إنشاء نموذج الطباعة
				createCashAccountStatementPrintForm(data, filters)
					.then(function (html) {
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
					"cash_account_statement_" +
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
};

// دالة للحصول على نوع المستند الأصلي للرابط
function getOriginalDocType(arabicType) {
	// تحويل النوع المعروض بالعربية إلى نوع المستند الأصلي
	const typeMap = {
		"سند قبض": "Payment Entry",
		"سند صرف": "Payment Entry",
		"سند تحويل داخلي": "Payment Entry",
		"فاتورة مبيعات": "Sales Invoice",
		"فاتورة مشتريات": "Purchase Invoice",
		"قيد محاسبي": "Journal Entry",
	};

	return typeMap[arabicType] || arabicType;
}

// وظيفة طباعة كشف الحساب
function createCashAccountStatementPrintForm(data, filters) {
	return new Promise(function (resolve, reject) {
		try {
			// الحصول على معلومات الشركة
			frappe.db.get_value(
				"Company",
				filters.company,
				["company_name", "tax_id"],
				function (companyInfo) {
					// الحصول على معلومات طريقة الدفع
					frappe.db.get_value(
						"Mode of Payment",
						filters.mode_of_payment,
						["name", "type"],
						function (paymentInfo) {
							// إنشاء صفوف جدول الحركات
							var transactionRows = [];

							// إضافة صفوف الحركات
							data.forEach(function (row) {
								if (!row.is_total_row) {
									// الحصول على نوع المستند الأصلي للرابط
									let doctype = getOriginalDocType(row.voucher_type);
									let voucherLink = row.voucher_no
										? `<a href="#Form/${doctype}/${row.voucher_no}" target="_blank">${row.voucher_no}</a>`
										: "";

									transactionRows.push(`
                                <tr>
                                    <td>${formatDate(row.posting_date)}</td>
                                    <td>${row.voucher_type || ""}</td>
                                    <td>${voucherLink}</td>
                                    <td>${row.description || ""}</td>
                                    <td class="en-number">${row.debit_amount > 0 ? format_currency(row.debit_amount) : ""}</td>
                                    <td class="en-number">${row.credit_amount > 0 ? format_currency(row.credit_amount) : ""}</td>
                                    <td class="en-number">${format_currency(row.running_balance)}</td>
                                    <td>${row.created_by || ""}</td>
                                </tr>
                            `);
								}
							});

							// إضافة صف الإجمالي
							var total_row = data.find((row) => row.is_total_row);
							if (total_row) {
								transactionRows.push(`
                            <tr style="font-weight: bold; background-color: #f2f2f2;">
                                <td colspan="4" style="text-align: center;">${__("الإجمالي")}</td>
                                <td class="en-number">${format_currency(total_row.debit_amount)}</td>
                                <td class="en-number">${format_currency(total_row.credit_amount)}</td>
                                <td class="en-number">${format_currency(total_row.running_balance)}</td>
                                <td></td>
                            </tr>
                        `);
							}

							// بناء قالب HTML للطباعة
							var currentDate = frappe.datetime.get_today();

							var html = `
                    <!DOCTYPE html>
                    <html dir="rtl">
                    <head>
                        <meta charset="UTF-8">
                        <title>كشف حساب طريقة الدفع</title>
                        <style>
                            @page {
                                size: A4 landscape;
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
                            .footer {
                                text-align: center;
                                margin-top: 5px;
                                font-size: 10px;
                                border-top: 1px solid #000;
                                padding-top: 5px;
                            }
                            /* تفعيل الأرقام الإنجليزية */
                            .en-number {
                                font-family: Arial, sans-serif !important;
                                -webkit-font-feature-settings: 'tnum';
                                font-feature-settings: 'tnum';
                                font-variant-numeric: tabular-nums;
                            }
                            /* تنسيق الروابط */
                            a {
                                text-decoration: none;
                                color: #1565C0;
                            }
                            a:hover {
                                text-decoration: underline;
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
                                a {
                                    color: #000;
                                    text-decoration: none;
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
                            كشف حساب طريقة الدفع: ${paymentInfo.name} / Cash Account Statement
                        </div>
                        
                        <table class="info-table">
                            <tr>
                                <td style="width: 15%; background-color: #f2f2f2; font-weight: bold; text-align: left;">الفترة / Period:</td>
                                <td style="width: 35%;" class="en-number">${formatDate(filters.from_date)} - ${formatDate(filters.to_date)}</td>
                                <td style="width: 15%; background-color: #f2f2f2; font-weight: bold; text-align: left;">تاريخ التقرير / Report Date:</td>
                                <td style="width: 35%;" class="en-number">${formatDate(currentDate)}</td>
                            </tr>
                        </table>
                        
                        <table class="transactions-table">
                            <thead>
                                <tr>
                                    <th style="width: 8%;">التاريخ<br/>Date</th>
                                    <th style="width: 10%;">نوع المستند<br/>Type</th>
                                    <th style="width: 12%;">رقم المستند<br/>Document No</th>
                                    <th style="width: 25%;">البيان<br/>Description</th>
                                    <th style="width: 10%;">مدين<br/>Debit</th>
                                    <th style="width: 10%;">دائن<br/>Credit</th>
                                    <th style="width: 10%;">الرصيد<br/>Balance</th>
                                    <th style="width: 15%;">المستخدم<br/>User</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${transactionRows.join("")}
                            </tbody>
                        </table>
                        
                        <div class="footer avoid-break">
                            تم إصدار هذا التقرير بتاريخ <span class="en-number">${formatDate(currentDate)}</span>
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

// دالة تنسيق التاريخ
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
		"نوع المستند",
		"رقم المستند",
		"البيان",
		"مدين",
		"دائن",
		"الرصيد",
		"المستخدم",
	];
	csvContent += headers.join(",") + "\r\n";

	// إضافة البيانات
	data.forEach(function (row) {
		if (!row.is_total_row) {
			var rowData = [
				row.posting_date || "",
				'"' + (row.voucher_type || "") + '"',
				'"' + (row.voucher_no || "") + '"',
				'"' + (row.description || "") + '"',
				row.debit_amount || 0,
				row.credit_amount || 0,
				row.running_balance || 0,
				'"' + (row.created_by || "") + '"',
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
