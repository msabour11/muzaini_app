// Copyright (c) 2026, Mohamed AbdElsabour and contributors
// For license information, please see license.txt

frappe.query_reports["Journal Entries Report"] = {
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
			fieldname: "voucher_type",
			label: __("نوع القيد"),
			fieldtype: "Select",
			options:
				"All\nJournal Entry\nBank Entry\nCash Entry\nCredit Note\nDebit Note\nContra Entry\nExcise Entry\nWrite Off Entry\nOpening Entry\nDepreciation Entry",
			default: "All",
			width: "150px",
		},
		{
			fieldname: "party_type",
			label: __("نوع الطرف"),
			fieldtype: "Select",
			options: "All\nCustomer\nSupplier\nEmployee\nShareholder",
			default: "All",
			width: "150px",
		},
		{
			fieldname: "party",
			label: __("الطرف"),
			fieldtype: "Dynamic Link",
			options: "party_type",
			width: "150px",
			get_query: function () {
				var party_type = frappe.query_report.get_filter_value("party_type");
				if (!party_type || party_type === "All") {
					frappe.throw(__("الرجاء تحديد نوع الطرف أولاً"));
				}
				return {
					filters: [["enabled", "=", 1]],
				};
			},
			depends_on: "eval:doc.party_type && doc.party_type !== 'All'",
		},
		{
			fieldname: "account",
			label: __("الحساب"),
			fieldtype: "Link",
			options: "Account",
			width: "150px",
			get_query: function () {
				return {
					filters: [
						["Account", "is_group", "=", 0],
						[
							"Account",
							"company",
							"=",
							frappe.query_report.get_filter_value("company"),
						],
					],
				};
			},
		},
		{
			fieldname: "cost_center",
			label: __("مركز التكلفة"),
			fieldtype: "Link",
			options: "Cost Center",
			width: "150px",
		},
		{
			fieldname: "status",
			label: __("الحالة"),
			fieldtype: "Select",
			options: "All\nDraft\nSubmitted\nCancelled",
			default: "Submitted",
			width: "150px",
		},
	],
	formatter: function (value, row, column, data, default_formatter) {
		if (data) {
			// تنسيق سطر الفاصل بين القيود
			if (data.is_separator) {
				return '<hr style="margin: 5px 0; border-top: 1px dashed #ccc;">';
			}

			// تنسيق نوع القيد بألوان مختلفة
			if (column.fieldname === "voucher_type") {
				let color = "black";
				if (value && value.includes("قيد يومية")) {
					color = "blue";
				} else if (value && value.includes("قيد بنكي")) {
					color = "green";
				} else if (value && value.includes("قيد نقدي")) {
					color = "purple";
				} else if (value && value.includes("إشعار دائن")) {
					color = "red";
				} else if (value && value.includes("إشعار مدين")) {
					color = "orange";
				} else if (value && value.includes("قيد افتتاحي")) {
					color = "brown";
				}

				if (value === "---") {
					return ""; // لا نعرض النص في سطر الفاصل
				}

				return `<span style="color: ${color}; font-weight: bold;">${value}</span>`;
			}

			// تنسيق حالة القيد
			if (column.fieldname === "status") {
				if (!value) return "";

				let color = "black";
				if (value.includes("ملغي")) {
					color = "red";
				} else if (value.includes("معتمد")) {
					color = "green";
				} else if (value.includes("مسودة")) {
					color = "gray";
				}

				return `<span style="color: ${color}; font-weight: bold;">${value}</span>`;
			}

			// تنسيق للمبالغ - أخضر للدائن وأحمر للمدين
			if (column.fieldname === "debit") {
				if (value > 0) {
					return (
						'<span style="color: red;">' +
						default_formatter(value, row, column, data) +
						"</span>"
					);
				}
			}

			if (column.fieldname === "credit") {
				if (value > 0) {
					return (
						'<span style="color: green;">' +
						default_formatter(value, row, column, data) +
						"</span>"
					);
				}
			}

			// تنسيق أساسي للإجماليات
			if (data.is_total || data.is_diff_total) {
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
		console.log("تم تحميل تقرير القيود اليومية");

		// إضافة CSS مخصص
		$(
			"<style>\
            .datatable .dt-cell { padding: 3px 5px !important; }\
            .datatable .dt-row { border-bottom: 1px solid #eee; }\
            .datatable .dt-header .dt-cell { background-color: #f5f7fa; font-weight: bold; }\
            .journal-summary-section { direction: rtl; }\
            .summary-card { background-color: #f8f8f8; border-radius: 5px; padding: 15px; margin-bottom: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }\
            .summary-card-title { font-weight: bold; margin-bottom: 10px; font-size: 16px; }\
            .summary-amount { font-size: 20px; font-weight: bold; }\
            .summary-card.debit { border-right: 5px solid #dc3545; }\
            .summary-card.credit { border-right: 5px solid #28a745; }\
            .summary-card.diff { border-right: 5px solid #17a2b8; }\
            .debit-amount { color: #dc3545; }\
            .credit-amount { color: #28a745; }\
            .diff-amount { color: #17a2b8; }\
        </style>"
		).appendTo("head");

		// إنشاء قسم ملخص القيود اليومية
		var $journalSummarySection = $(
			'<div class="journal-summary-section" style="margin-bottom: 20px; padding: 20px; background-color: #fff; border: 1px solid #ddd; border-radius: 5px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);"></div>'
		);
		var $journalSummaryHeader = $(
			'<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 2px solid #f0f0f0; padding-bottom: 10px;"><h3 style="margin: 0; color: #333; font-weight: bold;">' +
				__("ملخص القيود اليومية") +
				'</h3><div class="report-date"></div></div>'
		);

		// إنشاء صف لبطاقات الملخص
		var $summaryCardsSection = $(
			'<div class="summary-cards" style="display: flex; flex-wrap: wrap; gap: 15px; margin-bottom: 15px;"></div>'
		);

		// إنشاء بطاقات الملخص
		var $debitCard = $(
			'<div class="summary-card debit" style="flex: 1;"><div class="summary-card-title">' +
				__("إجمالي المدين") +
				'</div><div class="summary-amount debit-amount"></div></div>'
		);
		var $creditCard = $(
			'<div class="summary-card credit" style="flex: 1;"><div class="summary-card-title">' +
				__("إجمالي الدائن") +
				'</div><div class="summary-amount credit-amount"></div></div>'
		);
		var $diffCard = $(
			'<div class="summary-card diff" style="flex: 1;"><div class="summary-card-title">' +
				__("الفرق") +
				'</div><div class="summary-amount diff-amount"></div></div>'
		);

		$summaryCardsSection.append($debitCard).append($creditCard).append($diffCard);

		// إنشاء قسم تفاصيل القيود
		var $journalDetailsSection = $(
			'<div class="journal-details" style="margin-top: 20px;"></div>'
		);

		$journalSummarySection
			.append($journalSummaryHeader)
			.append($summaryCardsSection)
			.append($journalDetailsSection);

		// إضافة القسم في أعلى التقرير بعد المرشحات
		if (report.page.main.find(".journal-summary-section").length === 0) {
			report.page.main.find(".report-filter-section").after($journalSummarySection);
		}

		// تحديث تفاعلية المرشحات
		frappe.query_report.get_filter("party_type").df.on_change = function () {
			var party_type = frappe.query_report.get_filter_value("party_type");
			var party_filter = frappe.query_report.get_filter("party");

			if (party_type === "All") {
				party_filter.df.options = "";
				party_filter.set_input(null);
				party_filter.df.hidden = 1;
			} else {
				party_filter.df.options = party_type;
				party_filter.df.hidden = 0;

				// تحديث استعلام الطرف
				party_filter.df.get_query = function () {
					return {
						filters: [["enabled", "=", 1]],
					};
				};
			}

			party_filter.refresh();
		};

		// تحديث ملخص القيود عند تحميل البيانات
		var originalRefresh = report.refresh;
		report.refresh = function () {
			originalRefresh.call(this);

			// التأكد من توفر البيانات
			if (report.data && report.data.length > 0) {
				updateJournalSummary(report.data, report.get_values());
			}
		};

		// دالة تحديث ملخص القيود
		function updateJournalSummary(data, filters) {
			// تحديث تاريخ التقرير
			$(".report-date").html(
				`<span style="font-size: 14px;">${__("تاريخ التقرير")}: ${formatDate(
					frappe.datetime.get_today()
				)}</span>`
			);

			// حساب الإجماليات
			var totalDebit = 0;
			var totalCredit = 0;
			var entriesCount = 0;
			var uniqueEntries = new Set();

			data.forEach(function (row) {
				if (!row.is_total && !row.is_diff_total && !row.is_separator) {
					totalDebit += flt(row.debit);
					totalCredit += flt(row.credit);

					// حساب عدد القيود الفريدة
					if (row.name) {
						uniqueEntries.add(row.name);
					}
				}
			});

			entriesCount = uniqueEntries.size;

			// تحديث بطاقات الملخص
			$(".debit-amount").text(format_currency(totalDebit));
			$(".credit-amount").text(format_currency(totalCredit));

			// حساب وتحديث الفرق
			var diffAmount = totalDebit - totalCredit;
			var diffStatus =
				diffAmount === 0
					? "متوازن"
					: diffAmount > 0
					? "زيادة في المدين"
					: "زيادة في الدائن";
			var diffColor = diffAmount === 0 ? "#28a745" : "#dc3545";

			$(".diff-amount").html(
				`<span style="color: ${diffColor};">${format_currency(
					Math.abs(diffAmount)
				)}</span> <span style="font-size: 14px;">${diffStatus}</span>`
			);

			// تحديث تفاصيل القيود
			$(".journal-details").empty();

			// إنشاء تحليل للبيانات
			var voucherTypeData = {};
			var accountData = {};

			data.forEach(function (row) {
				if (!row.is_total && !row.is_diff_total && !row.is_separator) {
					// تجميع حسب نوع القيد
					if (row.voucher_type) {
						// نستخدم القيود الفريدة فقط (الصف الأول من كل قيد)
						if (row.posting_date) {
							var voucherTypeKey = row.voucher_type;

							if (!voucherTypeData[voucherTypeKey]) {
								voucherTypeData[voucherTypeKey] = {
									count: 0,
									debit: 0,
									credit: 0,
								};
							}

							voucherTypeData[voucherTypeKey].count += 1;
						}
					}

					// تجميع حسب الحسابات
					if (row.account) {
						if (!accountData[row.account]) {
							accountData[row.account] = {
								debit: 0,
								credit: 0,
							};
						}

						accountData[row.account].debit += flt(row.debit);
						accountData[row.account].credit += flt(row.credit);
					}
				}
			});

			// عرض تحليل البيانات
			var $analysisSection = $('<div style="margin-top: 20px;"></div>');

			// إضافة ملخص عام
			var $generalInfo = $(`
                <div style="margin-bottom: 20px; text-align: center;">
                    <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; display: inline-block;">
                        <span style="font-size: 16px; font-weight: bold;">${__(
							"إجمالي عدد القيود"
						)}: ${entriesCount}</span>
                        <span style="margin: 0 15px;">|</span>
                        <span style="font-size: 16px; font-weight: bold;">${__(
							"الفترة"
						)}: ${formatDate(filters.from_date)} - ${formatDate(
				filters.to_date
			)}</span>
                    </div>
                </div>
            `);

			$analysisSection.append($generalInfo);

			// تحليل حسب نوع القيد
			if (Object.keys(voucherTypeData).length > 0) {
				$analysisSection.append(
					'<h4 style="margin-bottom: 15px; color: #333; font-weight: bold;">' +
						__("التحليل حسب نوع القيد") +
						"</h4>"
				);
				var $voucherTypeTable = $(
					'<table class="table table-bordered" style="width: 100%; margin-bottom: 20px;"><thead><tr><th>' +
						__("نوع القيد") +
						"</th><th>" +
						__("العدد") +
						"</th><th>" +
						__("النسبة") +
						"</th></tr></thead><tbody></tbody></table>"
				);

				var totalVoucherCount = 0;
				Object.values(voucherTypeData).forEach(function (data) {
					totalVoucherCount += data.count;
				});

				Object.keys(voucherTypeData)
					.sort()
					.forEach(function (type) {
						var percentage = (
							(voucherTypeData[type].count / totalVoucherCount) *
							100
						).toFixed(1);

						$voucherTypeTable.find("tbody").append(`
                        <tr>
                            <td>${type}</td>
                            <td>${voucherTypeData[type].count}</td>
                            <td>${percentage}%</td>
                        </tr>
                    `);
					});

				$analysisSection.append($voucherTypeTable);
			}

			// تحليل أعلى الحسابات من حيث الحركة
			if (Object.keys(accountData).length > 0) {
				$analysisSection.append(
					'<h4 style="margin-bottom: 15px; color: #333; font-weight: bold;">' +
						__("أعلى الحسابات من حيث الحركة") +
						"</h4>"
				);
				var $accountTable = $(
					'<table class="table table-bordered" style="width: 100%; margin-bottom: 20px;"><thead><tr><th>' +
						__("الحساب") +
						"</th><th>" +
						__("المدين") +
						"</th><th>" +
						__("الدائن") +
						"</th><th>" +
						__("الصافي") +
						"</th></tr></thead><tbody></tbody></table>"
				);

				// تحويل البيانات إلى مصفوفة لترتيبها
				var accountsArray = Object.keys(accountData).map(function (key) {
					return {
						account: key,
						debit: accountData[key].debit,
						credit: accountData[key].credit,
						net: Math.abs(accountData[key].debit - accountData[key].credit),
					};
				});

				// ترتيب الحسابات حسب إجمالي الحركة (المدين + الدائن) تنازلياً
				accountsArray.sort(function (a, b) {
					return b.debit + b.credit - (a.debit + a.credit);
				});

				// عرض أعلى 10 حسابات فقط
				accountsArray.slice(0, 10).forEach(function (item) {
					var net = item.debit - item.credit;
					var netColor = net > 0 ? "red" : net < 0 ? "green" : "black";
					var netText = net > 0 ? "مدين" : net < 0 ? "دائن" : "متوازن";

					$accountTable.find("tbody").append(`
                        <tr>
                            <td>${item.account}</td>
                            <td style="color: red;">${format_currency(item.debit)}</td>
                            <td style="color: green;">${format_currency(item.credit)}</td>
                            <td style="color: ${netColor};">${format_currency(Math.abs(net))} ${netText}</td>
                        </tr>
                    `);
				});

				$analysisSection.append($accountTable);
			}

			$(".journal-details").append($analysisSection);
		}

		// إضافة زر الطباعة
		report.page.add_inner_button(__("طباعة القيود اليومية"), function () {
			if (report.data && report.data.length > 0) {
				var data = report.data;
				var filters = report.get_values();

				// عرض رسالة الانتظار أثناء تجهيز التقرير
				frappe.show_alert({
					message: __("جاري تجهيز التقرير للطباعة..."),
					indicator: "blue",
				});

				// إنشاء نموذج الطباعة
				createJournalPrintForm(data, filters)
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
									"تم حظر النوافذ المنبثقة. يرجى السماح بالنوافذ المنبثقة لطباعة التقرير."
								)
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
					"journal_entries_" + filters.from_date + "_to_" + filters.to_date + ".csv"
				);
			} else {
				frappe.msgprint(__("لا توجد بيانات للتصدير"));
			}
		});
	},
};

// وظيفة طباعة القيود اليومية
function createJournalPrintForm(data, filters) {
	return new Promise(function (resolve, reject) {
		try {
			// الحصول على معلومات الشركة
			frappe.db.get_value(
				"Company",
				filters.company,
				["company_name", "tax_id"],
				function (companyInfo) {
					// إنشاء جدول القيود اليومية
					var journalEntriesHTML = "";
					var currentJournalEntry = null;
					var journalEntryRows = [];
					var totalDebit = 0;
					var totalCredit = 0;

					// تجميع صفوف القيود
					data.forEach(function (row) {
						if (!row.is_total && !row.is_diff_total && !row.is_separator) {
							// حساب الإجماليات
							if (row.debit) totalDebit += flt(row.debit);
							if (row.credit) totalCredit += flt(row.credit);

							// إذا كان هذا صف جديد لقيد جديد
							if (
								row.posting_date &&
								(!currentJournalEntry || currentJournalEntry !== row.name)
							) {
								// إذا كان هناك قيد سابق، نضيفه للجدول
								if (currentJournalEntry && journalEntryRows.length > 0) {
									journalEntriesHTML +=
										createJournalEntryTable(journalEntryRows);
								}

								// نبدأ قيد جديد
								currentJournalEntry = row.name;
								journalEntryRows = [];
							}

							// إضافة الصف الحالي للقيد الحالي
							journalEntryRows.push(row);
						}
					});

					// إضافة آخر قيد
					if (currentJournalEntry && journalEntryRows.length > 0) {
						journalEntriesHTML += createJournalEntryTable(journalEntryRows);
					}

					// إنشاء صفحة الطباعة
					var currentDate = frappe.datetime.get_today();

					var html = `
                <!DOCTYPE html>
                <html dir="rtl">
                <head>
                    <meta charset="UTF-8">
                    <title>تقرير القيود اليومية</title>
                    <style>
                        @page {
                            size: A4 portrait;
                            margin: 0.5cm;
                        }
                        body { 
                            font-family: Arial, sans-serif; 
                            margin: 0; 
                            padding: 0;
                            direction: rtl;
                            font-size: 10px;
                            width: 100%;
                            box-sizing: border-box;
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
                            font-size: 9px;
                            overflow: hidden;
                        }
                        th { 
                            background-color: #f2f2f2; 
                            font-weight: bold;
                            font-size: 9px;
                        }
                        .report-title {
                            text-align: center;
                            margin: 5px 0;
                            font-size: 16px;
                            font-weight: bold;
                            border-bottom: 1px solid #000;
                            padding-bottom: 5px;
                        }
                        .journal-header {
                            background-color: #f5f7fa;
                            padding: 5px;
                            margin-top: 10px;
                            margin-bottom: 5px;
                            border: 1px solid #000;
                            font-weight: bold;
                            border-radius: 3px;
                        }
                        .journal-table {
                            margin-bottom: 15px;
                            page-break-inside: avoid;
                        }
                        .journal-table td:nth-child(3), .journal-table td:nth-child(4) {
                            text-align: right;
                        }
                        .debit-cell {
                            color: #dc3545;
                        }
                        .credit-cell {
                            color: #28a745;
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
                        .summary-table {
                            margin-top: 15px;
                            border: 2px solid #000;
                        }
                        .summary-table th {
                            background-color: #e6e6e6;
                        }
                        .remark-cell {
                            text-align: right;
                            max-width: 200px;
                            white-space: normal;
                        }
                        @media print {
                            body { 
                                margin: 0; 
                                print-color-adjust: exact;
                                -webkit-print-color-adjust: exact;
                            }
                            .journal-table {
                                page-break-inside: avoid;
                            }
                        }
                    </style>
                </head>
                <body>
                    <div class="company-info">
                        <h3>${companyInfo.company_name}</h3>
                        <div>الرقم الضريبي: <span class="en-number">${
							companyInfo.tax_id || "—"
						}</span></div>
                    </div>
                    
                    <div class="report-title">
                        تقرير القيود اليومية / Journal Entries Report
                    </div>
                    
                    <table class="info-table">
                        <tr>
                            <td style="width: 15%; background-color: #f2f2f2; font-weight: bold; text-align: left;">الفترة / Period:</td>
                            <td style="width: 35%;" class="en-number">${formatDate(
								filters.from_date
							)} - ${formatDate(filters.to_date)}</td>
                            <td style="width: 15%; background-color: #f2f2f2; font-weight: bold; text-align: left;">تاريخ التقرير / Report Date:</td>
                            <td style="width: 35%;" class="en-number">${formatDate(
								currentDate
							)}</td>
                        </tr>
                    </table>
                    
                    ${journalEntriesHTML}
                    
                    <!-- جدول الإجماليات -->
                    <table class="summary-table">
                        <thead>
                            <tr>
                                <th colspan="2">${__("ملخص القيود")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style="font-weight: bold; width: 50%;">${__(
									"إجمالي المدين"
								)}</td>
                                <td style="font-weight: bold; color: #dc3545;">${format_currency(
									totalDebit
								)}</td>
                            </tr>
                            <tr>
                                <td style="font-weight: bold;">${__("إجمالي الدائن")}</td>
                                <td style="font-weight: bold; color: #28a745;">${format_currency(
									totalCredit
								)}</td>
                            </tr>
                            <tr>
                                <td style="font-weight: bold;">${__("الفرق")}</td>
                                <td style="font-weight: bold; color: ${
									flt(totalDebit) === flt(totalCredit) ? "#28a745" : "#dc3545"
								};">
                                    ${format_currency(Math.abs(totalDebit - totalCredit))}
                                    ${
										flt(totalDebit) === flt(totalCredit)
											? " (متوازن)"
											: " (غير متوازن)"
									}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                    
                    <div class="footer">
                        تم إصدار هذا التقرير بتاريخ <span class="en-number">${formatDate(
							currentDate
						)}</span>
                    </div>
                </body>
                </html>
                `;

					resolve(html);
				}
			);
		} catch (error) {
			reject(error);
		}
	});
}

// وظيفة إنشاء جدول قيد يومية واحد
function createJournalEntryTable(rows) {
	if (!rows || rows.length === 0) return "";

	var firstRow = rows[0];
	var totalDebit = 0;
	var totalCredit = 0;

	// حساب إجماليات القيد
	rows.forEach(function (row) {
		totalDebit += flt(row.debit || 0);
		totalCredit += flt(row.credit || 0);
	});

	// هيكل الجدول
	var html = `
    <div class="journal-table">
        <div class="journal-header">
            <table style="width: 100%; border: none;">
                <tr>
                    <td style="border: none; width: 25%;">رقم القيد: ${firstRow.name}</td>
                    <td style="border: none; width: 25%;">التاريخ: ${formatDate(
						firstRow.posting_date
					)}</td>
                    <td style="border: none; width: 25%;">نوع القيد: ${firstRow.voucher_type}</td>
                    <td style="border: none; width: 25%;">الحالة: ${firstRow.status}</td>
                </tr>
            </table>
        </div>
        
        <table>
            <thead>
                <tr>
                    <th style="width: 35%;">${__("الحساب")}</th>
                    <th style="width: 20%;">${__("اسم الطرف")}</th>
                    <th style="width: 10%;">${__("المدين")}</th>
                    <th style="width: 10%;">${__("الدائن")}</th>
                    <th style="width: 25%;">${__("البيان")}</th>
                </tr>
            </thead>
            <tbody>
    `;

	// إضافة صفوف القيد
	rows.forEach(function (row) {
		html += `
            <tr>
                <td>${row.account || ""}</td>
                <td>${row.party_name || ""}</td>
                <td class="debit-cell en-number">${
					row.debit ? format_currency(row.debit) : ""
				}</td>
                <td class="credit-cell en-number">${
					row.credit ? format_currency(row.credit) : ""
				}</td>
                <td class="remark-cell">${row.user_remark || ""}</td>
            </tr>
        `;
	});

	// إضافة صف الإجمالي
	html += `
            <tr style="font-weight: bold; background-color: #f9f9f9;">
                <td colspan="2" style="text-align: center;">${__("الإجمالي")}</td>
                <td class="debit-cell en-number">${format_currency(totalDebit)}</td>
                <td class="credit-cell en-number">${format_currency(totalCredit)}</td>
                <td></td>
            </tr>
        </tbody>
    </table>
    </div>
    `;

	return html;
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
		"رقم القيد",
		"نوع القيد",
		"الحساب",
		"اسم الطرف",
		"نوع الطرف",
		"المدين",
		"الدائن",
		"مركز التكلفة",
		"نوع المرجع",
		"رقم المرجع",
		"الملاحظات",
		"الحالة",
	];
	csvContent += headers.join(",") + "\r\n";

	// إضافة البيانات
	data.forEach(function (row) {
		if (!row.is_total && !row.is_diff_total && !row.is_separator) {
			var rowData = [
				row.posting_date || "",
				'"' + (row.name || "") + '"',
				'"' + (row.voucher_type || "") + '"',
				'"' + (row.account || "") + '"',
				'"' + (row.party_name || "") + '"',
				'"' + (row.party_type || "") + '"',
				row.debit || 0,
				row.credit || 0,
				'"' + (row.cost_center || "") + '"',
				'"' + (row.reference_type || "") + '"',
				'"' + (row.reference_name || "") + '"',
				'"' + (row.user_remark || "") + '"',
				'"' + (row.status || "") + '"',
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
