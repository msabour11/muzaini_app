// Copyright (c) 2026, Mohamed AbdElsabour and contributors
// For license information, please see license.txt

frappe.query_reports["Payment Register Report"] = {
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
			fieldname: "payment_type",
			label: __("نوع السند"),
			fieldtype: "Select",
			options: "All\nReceive\nPay\nInternal Transfer",
			default: "All",
			width: "150px",
			translatable: true,
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
			fieldname: "mode_of_payment",
			label: __("طريقة الدفع"),
			fieldtype: "Link",
			options: "Mode of Payment",
			width: "150px",
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
			// تنسيق سندات القبض والصرف بألوان مختلفة
			if (column.fieldname === "payment_type") {
				let color = "black";
				if (value && value.includes("سند قبض")) {
					color = "green";
				} else if (value && value.includes("سند صرف")) {
					color = "red";
				} else if (value && value.includes("تحويل داخلي")) {
					color = "blue";
				}
				return `<span style="color: ${color}; font-weight: bold;">${value}</span>`;
			}

			// تنسيق حالة السند
			if (column.fieldname === "status") {
				if (!value) return "";

				let color = "black";
				if (value.includes("ملغي")) {
					color = "red";
				} else if (value.includes("مدفوع")) {
					color = "green";
				} else if (value.includes("غير مدفوع") || value.includes("متأخر")) {
					color = "orange";
				} else if (value.includes("مسودة")) {
					color = "gray";
				}

				return `<span style="color: ${color}; font-weight: bold;">${value}</span>`;
			}

			// تنسيق للمبلغ - أخضر للمقبوضات وأحمر للمدفوعات
			if (column.fieldname === "paid_amount") {
				if (data.is_receipt_total) {
					return (
						'<span style="color: green; font-weight: bold;">' +
						default_formatter(value, row, column, data) +
						"</span>"
					);
				} else if (data.is_payment_total) {
					return (
						'<span style="color: red; font-weight: bold;">' +
						default_formatter(value, row, column, data) +
						"</span>"
					);
				} else if (data.is_net_total) {
					var color = value >= 0 ? "green" : "red";
					return (
						'<span style="color: ' +
						color +
						'; font-weight: bold;">' +
						default_formatter(Math.abs(value), row, column, data) +
						(value >= 0 ? " فائض" : " عجز") +
						"</span>"
					);
				} else if (data.payment_type && data.payment_type.includes("سند قبض")) {
					return (
						'<span style="color: green;">' +
						default_formatter(value, row, column, data) +
						"</span>"
					);
				} else if (data.payment_type && data.payment_type.includes("سند صرف")) {
					return (
						'<span style="color: red;">' +
						default_formatter(value, row, column, data) +
						"</span>"
					);
				}
			}

			// تنسيق أساسي للإجماليات
			if (data.is_receipt_total || data.is_payment_total || data.is_net_total) {
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
		console.log("تم تحميل تقرير سجل المقبوضات والمدفوعات");

		// إضافة CSS مخصص
		$(
			"<style>\
            .datatable .dt-cell { padding: 0px !important; }\
            .datatable .dt-row { border-bottom: 1px solid #eee; }\
            .datatable .dt-header .dt-cell { background-color: #f5f7fa; font-weight: bold; }\
            .payment-summary-section { direction: rtl; }\
            .summary-card { background-color: #f8f8f8; border-radius: 5px; padding: 15px; margin-bottom: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }\
            .summary-card-title { font-weight: bold; margin-bottom: 10px; font-size: 16px; }\
            .summary-amount { font-size: 20px; font-weight: bold; }\
            .summary-card.receipt { border-right: 5px solid #28a745; }\
            .summary-card.payment { border-right: 5px solid #dc3545; }\
            .summary-card.net { border-right: 5px solid #17a2b8; }\
            .receipt-amount { color: #28a745; }\
            .payment-amount { color: #dc3545; }\
            .net-amount { color: #17a2b8; }\
        </style>"
		).appendTo("head");

		// إنشاء قسم ملخص المقبوضات والمدفوعات
		var $paymentSummarySection = $(
			'<div class="payment-summary-section" style="margin-bottom: 20px; padding: 20px; background-color: #fff; border: 1px solid #ddd; border-radius: 5px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);"></div>'
		);
		var $paymentSummaryHeader = $(
			'<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 2px solid #f0f0f0; padding-bottom: 10px;"><h3 style="margin: 0; color: #333; font-weight: bold;">' +
				__("ملخص المقبوضات والمدفوعات") +
				'</h3><div class="report-date"></div></div>'
		);

		// إنشاء صف لبطاقات الملخص
		var $summaryCardsSection = $(
			'<div class="summary-cards" style="display: flex; flex-wrap: wrap; gap: 15px; margin-bottom: 15px;"></div>'
		);

		// إنشاء بطاقات الملخص
		var $receiptCard = $(
			'<div class="summary-card receipt" style="flex: 1;"><div class="summary-card-title">' +
				__("إجمالي المقبوضات") +
				'</div><div class="summary-amount receipt-amount"></div></div>'
		);
		var $paymentCard = $(
			'<div class="summary-card payment" style="flex: 1;"><div class="summary-card-title">' +
				__("إجمالي المدفوعات") +
				'</div><div class="summary-amount payment-amount"></div></div>'
		);
		var $netCard = $(
			'<div class="summary-card net" style="flex: 1;"><div class="summary-card-title">' +
				__("صافي الحركة") +
				'</div><div class="summary-amount net-amount"></div></div>'
		);

		$summaryCardsSection.append($receiptCard).append($paymentCard).append($netCard);

		// إنشاء قسم تفاصيل المقبوضات والمدفوعات
		var $paymentDetailsSection = $(
			'<div class="payment-details" style="margin-top: 20px;"></div>'
		);

		$paymentSummarySection
			.append($paymentSummaryHeader)
			.append($summaryCardsSection)
			.append($paymentDetailsSection);

		// إضافة القسم في أعلى التقرير بعد المرشحات
		if (report.page.main.find(".payment-summary-section").length === 0) {
			report.page.main.find(".report-filter-section").after($paymentSummarySection);
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

		// تحديث ملخص المقبوضات والمدفوعات عند تحميل البيانات
		var originalRefresh = report.refresh;
		report.refresh = function () {
			originalRefresh.call(this);

			// التأكد من توفر البيانات
			if (report.data && report.data.length > 0) {
				updatePaymentSummary(report.data, report.get_values());
			}
		};

		// دالة تحديث ملخص المقبوضات والمدفوعات
		function updatePaymentSummary(data, filters) {
			// تحديث تاريخ التقرير
			$(".report-date").html(
				`<span style="font-size: 14px;">${__("تاريخ التقرير")}: ${formatDate(
					frappe.datetime.get_today()
				)}</span>`
			);

			// حساب الإجماليات
			var totalReceipts = 0;
			var totalPayments = 0;
			var receiptCount = 0;
			var paymentCount = 0;

			data.forEach(function (row) {
				if (!row.is_receipt_total && !row.is_payment_total && !row.is_net_total) {
					if (row.payment_type && row.payment_type.includes("سند قبض")) {
						totalReceipts += flt(row.paid_amount);
						receiptCount++;
					} else if (row.payment_type && row.payment_type.includes("سند صرف")) {
						totalPayments += flt(row.paid_amount);
						paymentCount++;
					}
				}
			});

			// تحديث بطاقات الملخص
			$(".receipt-amount").text(format_currency(totalReceipts) + ` (${receiptCount} سند)`);
			$(".payment-amount").text(format_currency(totalPayments) + ` (${paymentCount} سند)`);

			// حساب وتحديث صافي الحركة
			var netAmount = totalReceipts - totalPayments;
			var netStatus = netAmount >= 0 ? "فائض" : "عجز";
			var netColor = netAmount >= 0 ? "#28a745" : "#dc3545";

			$(".net-amount").html(
				`<span style="color: ${netColor};">${format_currency(
					Math.abs(netAmount)
				)}</span> <span style="font-size: 14px;">${netStatus}</span>`
			);

			// تحديث تفاصيل المقبوضات والمدفوعات
			$(".payment-details").empty();

			// إنشاء تحليل بسيط للبيانات
			var modeOfPaymentData = {};
			var partyTypeData = {};

			data.forEach(function (row) {
				if (!row.is_receipt_total && !row.is_payment_total && !row.is_net_total) {
					// تجميع حسب طريقة الدفع
					if (row.mode_of_payment) {
						if (!modeOfPaymentData[row.mode_of_payment]) {
							modeOfPaymentData[row.mode_of_payment] = {
								receipts: 0,
								payments: 0,
							};
						}

						if (row.payment_type && row.payment_type.includes("سند قبض")) {
							modeOfPaymentData[row.mode_of_payment].receipts += flt(
								row.paid_amount
							);
						} else if (row.payment_type && row.payment_type.includes("سند صرف")) {
							modeOfPaymentData[row.mode_of_payment].payments += flt(
								row.paid_amount
							);
						}
					}

					// تجميع حسب نوع الطرف
					if (row.party_type) {
						var partyTypeKey = row.party_type;

						if (!partyTypeData[partyTypeKey]) {
							partyTypeData[partyTypeKey] = {
								receipts: 0,
								payments: 0,
							};
						}

						if (row.payment_type && row.payment_type.includes("سند قبض")) {
							partyTypeData[partyTypeKey].receipts += flt(row.paid_amount);
						} else if (row.payment_type && row.payment_type.includes("سند صرف")) {
							partyTypeData[partyTypeKey].payments += flt(row.paid_amount);
						}
					}
				}
			});

			// عرض تحليل البيانات
			var $analysisSection = $('<div style="margin-top: 20px;"></div>');

			// تحليل حسب طريقة الدفع
			if (Object.keys(modeOfPaymentData).length > 0) {
				$analysisSection.append(
					'<h4 style="margin-bottom: 15px; color: #333; font-weight: bold;">' +
						__("التحليل حسب طريقة الدفع") +
						"</h4>"
				);
				var $modeOfPaymentTable = $(
					'<table class="table table-bordered" style="width: 100%; margin-bottom: 20px;"><thead><tr><th>' +
						__("طريقة الدفع") +
						"</th><th>" +
						__("المقبوضات") +
						"</th><th>" +
						__("المدفوعات") +
						"</th><th>" +
						__("الصافي") +
						"</th></tr></thead><tbody></tbody></table>"
				);

				Object.keys(modeOfPaymentData).forEach(function (mode) {
					var net = modeOfPaymentData[mode].receipts - modeOfPaymentData[mode].payments;
					var netColor = net >= 0 ? "green" : "red";

					$modeOfPaymentTable.find("tbody").append(`
                        <tr>
                            <td>${mode}</td>
                            <td style="color: green;">${format_currency(
								modeOfPaymentData[mode].receipts
							)}</td>
                            <td style="color: red;">${format_currency(
								modeOfPaymentData[mode].payments
							)}</td>
                            <td style="color: ${netColor};">${format_currency(Math.abs(net))} ${net >= 0 ? "فائض" : "عجز"}</td>
                        </tr>
                    `);
				});

				$analysisSection.append($modeOfPaymentTable);
			}

			// تحليل حسب نوع الطرف
			if (Object.keys(partyTypeData).length > 0) {
				$analysisSection.append(
					'<h4 style="margin-bottom: 15px; color: #333; font-weight: bold;">' +
						__("التحليل حسب نوع الطرف") +
						"</h4>"
				);
				var $partyTypeTable = $(
					'<table class="table table-bordered" style="width: 100%; margin-bottom: 20px;"><thead><tr><th>' +
						__("نوع الطرف") +
						"</th><th>" +
						__("المقبوضات") +
						"</th><th>" +
						__("المدفوعات") +
						"</th><th>" +
						__("الصافي") +
						"</th></tr></thead><tbody></tbody></table>"
				);

				Object.keys(partyTypeData).forEach(function (type) {
					var net = partyTypeData[type].receipts - partyTypeData[type].payments;
					var netColor = net >= 0 ? "green" : "red";

					$partyTypeTable.find("tbody").append(`
                        <tr>
                            <td>${type}</td>
                            <td style="color: green;">${format_currency(
								partyTypeData[type].receipts
							)}</td>
                            <td style="color: red;">${format_currency(
								partyTypeData[type].payments
							)}</td>
                            <td style="color: ${netColor};">${format_currency(Math.abs(net))} ${net >= 0 ? "فائض" : "عجز"}</td>
                        </tr>
                    `);
				});

				$analysisSection.append($partyTypeTable);
			}

			$(".payment-details").append($analysisSection);
		}

		// إضافة زر الطباعة
		report.page.add_inner_button(__("طباعة سجل المقبوضات والمدفوعات"), function () {
			if (report.data && report.data.length > 0) {
				var data = report.data;
				var filters = report.get_values();

				// عرض رسالة الانتظار أثناء تجهيز التقرير
				frappe.show_alert({
					message: __("جاري تجهيز التقرير للطباعة..."),
					indicator: "blue",
				});

				// إنشاء نموذج الطباعة
				createPaymentRegisterPrintForm(data, filters)
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
					"payment_register_" + filters.from_date + "_to_" + filters.to_date + ".csv"
				);
			} else {
				frappe.msgprint(__("لا توجد بيانات للتصدير"));
			}
		});
	},
};

// وظيفة طباعة سجل المقبوضات والمدفوعات
function createPaymentRegisterPrintForm(data, filters) {
	return new Promise(function (resolve, reject) {
		try {
			// الحصول على معلومات الشركة
			frappe.db.get_value(
				"Company",
				filters.company,
				["company_name", "tax_id"],
				function (companyInfo) {
					// إنشاء صفوف جدول المقبوضات والمدفوعات
					var paymentRows = [];

					// إضافة صفوف المقبوضات والمدفوعات
					var totalReceipts = 0;
					var totalPayments = 0;

					data.forEach(function (row) {
						if (!row.is_receipt_total && !row.is_payment_total && !row.is_net_total) {
							if (row.payment_type && row.payment_type.includes("سند قبض")) {
								totalReceipts += flt(row.paid_amount);
							} else if (row.payment_type && row.payment_type.includes("سند صرف")) {
								totalPayments += flt(row.paid_amount);
							}

							paymentRows.push(`
                            <tr>
                                <td>${formatDate(row.posting_date)}</td>
                                <td>${row.name || ""}</td>
                                <td>${row.payment_type || ""}</td>
                                <td>${row.party_name || ""}</td>
                                <td>${row.party_type || ""}</td>
                                <td style="${
									row.payment_type && row.payment_type.includes("سند قبض")
										? "color: green;"
										: row.payment_type && row.payment_type.includes("سند صرف")
										? "color: red;"
										: ""
								}">${format_currency(row.paid_amount)}</td>
                                <td>${row.account || ""}</td>
                                <td>${row.mode_of_payment || ""}</td>
                                <td>${row.reference_no || ""}</td>
                                <td>${row.cost_center || ""}</td>
                                <td>${row.status || ""}</td>
                            </tr>
                        `);
						}
					});

					// إضافة صفوف الإجمالي
					var netAmount = totalReceipts - totalPayments;

					paymentRows.push(`
                    <tr style="font-weight: bold; background-color: #f2f2f2;">
                        <td colspan="5" style="text-align: center;">${__("إجمالي المقبوضات")}</td>
                        <td style="color: green;">${format_currency(totalReceipts)}</td>
                        <td colspan="5"></td>
                    </tr>
                    <tr style="font-weight: bold; background-color: #f2f2f2;">
                        <td colspan="5" style="text-align: center;">${__("إجمالي المدفوعات")}</td>
                        <td style="color: red;">${format_currency(totalPayments)}</td>
                        <td colspan="5"></td>
                    </tr>
                    <tr style="font-weight: bold; background-color: #f2f2f2;">
                        <td colspan="5" style="text-align: center;">${__("صافي الحركة")}</td>
                        <td style="color: ${netAmount >= 0 ? "green" : "red"};">${format_currency(
						Math.abs(netAmount)
					)} ${netAmount >= 0 ? "فائض" : "عجز"}</td>
                        <td colspan="5"></td>
                    </tr>
                `);

					// بناء قالب HTML للطباعة
					var currentDate = frappe.datetime.get_today();

					var html = `
                <!DOCTYPE html>
                <html dir="rtl">
                <head>
                    <meta charset="UTF-8">
                    <title>سجل المقبوضات والمدفوعات</title>
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
                            font-size: 10px;
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
                        <div>الرقم الضريبي: <span class="en-number">${
							companyInfo.tax_id || "—"
						}</span></div>
                    </div>
                    
                    <div class="report-title">
                        سجل المقبوضات والمدفوعات / Payment Register
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
                    
                    <table class="payment-table">
                        <thead>
                            <tr>
                                <th style="width: 7%;">التاريخ<br/>Date</th>
                                <th style="width: 7%;">رقم السند<br/>No</th>
                                <th style="width: 7%;">نوع السند<br/>Type</th>
                                <th style="width: 13%;">اسم الطرف<br/>Party</th>
                                <th style="width: 7%;">نوع الطرف<br/>Party Type</th>
                                <th style="width: 8%;">المبلغ<br/>Amount</th>
                                <th style="width: 12%;">الحساب<br/>Account</th>
                                <th style="width: 10%;">طريقة الدفع<br/>Payment Method</th>
                                <th style="width: 8%;">الرقم المرجعي<br/>Ref No</th>
                                <th style="width: 10%;">مركز التكلفة<br/>Cost Center</th>
                                <th style="width: 7%;">الحالة<br/>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${paymentRows.join("")}
                        </tbody>
                    </table>
                    
                    <div class="footer avoid-break">
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
		"رقم السند",
		"نوع السند",
		"اسم الطرف",
		"نوع الطرف",
		"المبلغ",
		"الحساب",
		"طريقة الدفع",
		"الرقم المرجعي",
		"مركز التكلفة",
		"الحالة",
	];
	csvContent += headers.join(",") + "\r\n";

	// إضافة البيانات
	data.forEach(function (row) {
		if (!row.is_receipt_total && !row.is_payment_total && !row.is_net_total) {
			var rowData = [
				row.posting_date || "",
				'"' + (row.name || "") + '"',
				'"' + (row.payment_type || "") + '"',
				'"' + (row.party_name || "") + '"',
				'"' + (row.party_type || "") + '"',
				row.paid_amount || 0,
				'"' + (row.account || "") + '"',
				'"' + (row.mode_of_payment || "") + '"',
				'"' + (row.reference_no || "") + '"',
				'"' + (row.cost_center || "") + '"',
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
