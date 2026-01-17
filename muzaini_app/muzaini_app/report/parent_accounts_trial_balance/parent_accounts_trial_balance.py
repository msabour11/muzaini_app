# Copyright (c) 2026, Mohamed AbdElsabour and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.utils import flt, getdate, cstr, today
from erpnext.accounts.report.trial_balance.trial_balance import (
    execute as trial_balance_execute,
)


def execute(filters=None):
    """
    Custom trial balance report that shows accounts based on the selected parent account filter
    and cost center if specified
    """
    if not filters:
        filters = {}

    # Convert to frappe._dict to ensure attribute access works correctly
    if not isinstance(filters, frappe._dict):
        filters = frappe._dict(filters)

    # Get the selected parent account and cost center
    parent_filter = filters.get("parent_account_filter")
    cost_center = filters.get("cost_center")

    # Ensure required filters are present
    if not filters.company:
        filters.company = frappe.defaults.get_user_default("Company")

    # Handle fiscal year safely
    if not filters.fiscal_year:
        filters.fiscal_year = frappe.defaults.get_user_default("fiscal_year")

    # If we still don't have a fiscal year or need to set dates
    if not filters.from_date or not filters.to_date:
        try:
            year_dates = frappe.db.get_value(
                "Fiscal Year", filters.fiscal_year, ["year_start_date", "year_end_date"]
            )

            # Only unpack if we got a valid result
            if (
                year_dates
                and isinstance(year_dates, (list, tuple))
                and len(year_dates) == 2
            ):
                from_date, to_date = year_dates
                filters.from_date = from_date
                filters.to_date = to_date
            else:
                # Fallback to current fiscal year
                current_fiscal_year = frappe.get_all(
                    "Fiscal Year",
                    filters={"disabled": 0},
                    order_by="year_start_date desc",
                    limit=1,
                )
                if current_fiscal_year:
                    fiscal_year = frappe.get_doc(
                        "Fiscal Year", current_fiscal_year[0].name
                    )
                    filters.fiscal_year = fiscal_year.name
                    filters.from_date = fiscal_year.year_start_date
                    filters.to_date = fiscal_year.year_end_date
                else:
                    # Last resort fallback
                    filters.from_date = filters.from_date or today()
                    filters.to_date = filters.to_date or today()
        except Exception as e:
            frappe.log_error(f"Error setting fiscal year dates: {str(e)}")
            # Fallback to today as a last resort
            filters.from_date = filters.from_date or today()
            filters.to_date = filters.to_date or today()

    # Call the standard trial balance report function to get all the data
    columns, data = trial_balance_execute(filters)

    # Filter data based on parent account selection
    filtered_data = filter_by_parent_account(data, parent_filter)

    # Remove empty rows for cleaner display when 'show_zero_values' is not set
    if not filters.get("show_zero_values"):
        filtered_data = [
            row
            for row in filtered_data
            if (
                (
                    row.get("account")
                    and (
                        flt(row.get("opening_debit")) != 0
                        or flt(row.get("opening_credit")) != 0
                        or flt(row.get("debit")) != 0
                        or flt(row.get("credit")) != 0
                        or flt(row.get("closing_debit")) != 0
                        or flt(row.get("closing_credit")) != 0
                    )
                )
                or
                # Keep total row
                (not row.get("account") or row.get("account_name") == "Total")
            )
        ]

    # Add proper indentation for accounts to show hierarchy
    filtered_data = add_indentation(filtered_data)

    # Update columns to match the expected trial balance format, if needed
    updated_columns = get_updated_columns(columns)

    return updated_columns, filtered_data


def get_updated_columns(columns):
    """
    Modify columns to match the expected trial balance format
    """
    # Define the expected order and structure of columns for the trial balance
    # This can be adjusted based on the desired output format
    column_map = {
        "account": {
            "label": _("Account"),
            "fieldtype": "Link",
            "options": "Account",
            "width": 300,
        },
        "opening_debit": {
            "label": _("Opening (Dr)"),
            "fieldtype": "Currency",
            "width": 120,
        },
        "opening_credit": {
            "label": _("Opening (Cr)"),
            "fieldtype": "Currency",
            "width": 120,
        },
        "debit": {"label": _("Debit"), "fieldtype": "Currency", "width": 120},
        "credit": {"label": _("Credit"), "fieldtype": "Currency", "width": 120},
        "closing_debit": {
            "label": _("Closing (Dr)"),
            "fieldtype": "Currency",
            "width": 120,
        },
        "closing_credit": {
            "label": _("Closing (Cr)"),
            "fieldtype": "Currency",
            "width": 120,
        },
    }

    updated_columns = []

    # You can reorder or modify the columns based on your requirements
    for col_key in [
        "account",
        "opening_debit",
        "opening_credit",
        "debit",
        "credit",
        "closing_debit",
        "closing_credit",
    ]:
        if col_key in column_map:
            # Find if the column already exists in the original columns
            existing_col = next(
                (col for col in columns if col.get("fieldname") == col_key), None
            )

            if existing_col:
                # Update with our preferred settings but keep any other attributes
                existing_col.update(column_map[col_key])
                updated_columns.append(existing_col)
            else:
                # Create a new column if not found
                new_col = column_map[col_key].copy()
                new_col["fieldname"] = col_key
                updated_columns.append(new_col)

    return updated_columns


def filter_by_parent_account(data, parent_filter):
    """
    Filter data to show only accounts that belong to the selected parent account
    or show all accounts if no parent is selected
    """
    # If no parent is selected, return all data
    if not parent_filter:
        return data

    filtered_data = []

    # Get all accounts that belong to the selected parent
    try:
        lft, rgt = frappe.db.get_value("Account", parent_filter, ["lft", "rgt"])
        if lft and rgt:
            child_accounts = frappe.db.sql(
                """
                SELECT name
                FROM `tabAccount`
                WHERE lft >= %s AND rgt <= %s
            """,
                (lft, rgt),
                as_dict=1,
            )

            # Create a set of account names for faster lookup
            child_account_names = {account.name for account in child_accounts}

            # Include the parent account itself
            child_account_names.add(parent_filter)

            # Filter the data to include only accounts in the set
            for row in data:
                account = row.get("account")

                # Keep rows that don't have an account (like the total row) or rows with accounts in our set
                if not account or account in child_account_names:
                    filtered_data.append(row)
        else:
            # If we can't find the parent account's lft/rgt, return all data
            return data
    except Exception as e:
        frappe.log_error(f"Error filtering by parent account: {str(e)}")
        return data

    # Recalculate the total row if present
    total_row = None
    remaining_rows = []

    for row in filtered_data:
        if not row.get("account") or row.get("account_name") == "Total":
            total_row = row
        else:
            remaining_rows.append(row)

    if total_row:
        # Remove the total row temporarily
        filtered_data = remaining_rows

        # Calculate totals based on filtered data
        total_opening_debit = sum(
            flt(row.get("opening_debit", 0)) for row in filtered_data
        )
        total_opening_credit = sum(
            flt(row.get("opening_credit", 0)) for row in filtered_data
        )
        total_debit = sum(flt(row.get("debit", 0)) for row in filtered_data)
        total_credit = sum(flt(row.get("credit", 0)) for row in filtered_data)
        total_closing_debit = sum(
            flt(row.get("closing_debit", 0)) for row in filtered_data
        )
        total_closing_credit = sum(
            flt(row.get("closing_credit", 0)) for row in filtered_data
        )

        # Update total row with recalculated totals
        total_row.update(
            {
                "account_name": "Total",
                "opening_debit": total_opening_debit,
                "opening_credit": total_opening_credit,
                "debit": total_debit,
                "credit": total_credit,
                "closing_debit": total_closing_debit,
                "closing_credit": total_closing_credit,
            }
        )

        # Add the total row back
        filtered_data.append(total_row)

    return filtered_data


def add_indentation(data):
    """
    Add proper indentation to accounts based on their hierarchy level
    """
    # Create a temporary map to store account hierarchy information
    account_map = {}

    # First, let's extract all accounts that have parent accounts
    for row in data:
        if row.get("account"):
            account_map[row.get("account")] = {"row": row, "level": 0}

    # Now calculate the indentation level for each account
    for account_name, info in account_map.items():
        try:
            # Get the account details to determine its level in the hierarchy
            account = frappe.get_doc("Account", account_name)
            level = 0

            # Count how many parent accounts this account has to determine its level
            parent = account.parent_account
            while parent:
                level += 1
                parent_doc = frappe.get_doc("Account", parent)
                parent = parent_doc.parent_account

                # Safety check to avoid infinite loops
                if level > 10:  # Reasonable max depth
                    break

            # Store the calculated level
            info["level"] = level
            info["row"]["indent"] = level
        except Exception as e:
            # Just continue if we can't determine the level
            continue

    return data
