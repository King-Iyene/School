/*
  # Finance, Library, Transport & Dormitory Tables

  ## New Tables

  ### Finance
  - `chart_of_accounts` - Account heads and types
  - `payment_methods_list` - Available payment methods
  - `bank_accounts` - School bank accounts
  - `income_records` - Income transactions
  - `expense_records` - Expense transactions
  - `fees_groups` - Grouping of fee types
  - `fees_types` - Types of fees
  - `fees_master` - Fee structures per class
  - `fees_discounts` - Discount definitions
  - `fees_collections` - Fee payment records
  - `fees_carry_forward` - Previous year balance carry forward

  ### Library
  - `books` - Library catalog
  - `book_issues` - Book lending records

  ### Transport
  - `transport_routes` - Routes with fares
  - `transport_vehicles` - Vehicle details
  - `transport_assignments` - Student-route assignments

  ### Dormitory
  - `dormitory_rooms` - Room definitions
  - `dormitory_assignments` - Student room assignments

  ## Security
  RLS enabled on all tables with school_id scoping.
*/

-- Chart of Accounts
CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  account_name text NOT NULL,
  account_code text,
  account_type text DEFAULT 'income' CHECK (account_type IN ('asset', 'liability', 'income', 'expense', 'equity')),
  parent_id uuid REFERENCES chart_of_accounts(id) ON DELETE SET NULL,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members can view chart of accounts"
  ON chart_of_accounts FOR SELECT TO authenticated USING (school_id = get_my_school_id());
CREATE POLICY "Super admin can insert chart of accounts"
  ON chart_of_accounts FOR INSERT TO authenticated
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'accountant'));
CREATE POLICY "Super admin can update chart of accounts"
  ON chart_of_accounts FOR UPDATE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'accountant'))
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'accountant'));
CREATE POLICY "Super admin can delete chart of accounts"
  ON chart_of_accounts FOR DELETE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'accountant'));

-- Payment Methods List
CREATE TABLE IF NOT EXISTS payment_methods_list (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE payment_methods_list ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members can view payment methods"
  ON payment_methods_list FOR SELECT TO authenticated USING (school_id = get_my_school_id());
CREATE POLICY "Super admin can insert payment methods"
  ON payment_methods_list FOR INSERT TO authenticated
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'accountant'));
CREATE POLICY "Super admin can update payment methods"
  ON payment_methods_list FOR UPDATE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'accountant'))
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'accountant'));
CREATE POLICY "Super admin can delete payment methods"
  ON payment_methods_list FOR DELETE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'accountant'));

-- Bank Accounts
CREATE TABLE IF NOT EXISTS bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  account_name text NOT NULL,
  account_number text,
  bank_name text,
  branch text,
  opening_balance numeric(15,2) DEFAULT 0,
  current_balance numeric(15,2) DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members can view bank accounts"
  ON bank_accounts FOR SELECT TO authenticated USING (school_id = get_my_school_id());
CREATE POLICY "Super admin can insert bank accounts"
  ON bank_accounts FOR INSERT TO authenticated
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'accountant'));
CREATE POLICY "Super admin can update bank accounts"
  ON bank_accounts FOR UPDATE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'accountant'))
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'accountant'));
CREATE POLICY "Super admin can delete bank accounts"
  ON bank_accounts FOR DELETE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'accountant'));

-- Income Records
CREATE TABLE IF NOT EXISTS income_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  account_id uuid REFERENCES chart_of_accounts(id) ON DELETE SET NULL,
  bank_account_id uuid REFERENCES bank_accounts(id) ON DELETE SET NULL,
  payment_method_id uuid REFERENCES payment_methods_list(id) ON DELETE SET NULL,
  amount numeric(15,2) NOT NULL,
  income_date date NOT NULL,
  reference_no text,
  description text,
  source_name text,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE income_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members can view income records"
  ON income_records FOR SELECT TO authenticated USING (school_id = get_my_school_id());
CREATE POLICY "Super admin can insert income records"
  ON income_records FOR INSERT TO authenticated
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'accountant'));
CREATE POLICY "Super admin can update income records"
  ON income_records FOR UPDATE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'accountant'))
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'accountant'));
CREATE POLICY "Super admin can delete income records"
  ON income_records FOR DELETE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'accountant'));

-- Expense Records
CREATE TABLE IF NOT EXISTS expense_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  account_id uuid REFERENCES chart_of_accounts(id) ON DELETE SET NULL,
  bank_account_id uuid REFERENCES bank_accounts(id) ON DELETE SET NULL,
  payment_method_id uuid REFERENCES payment_methods_list(id) ON DELETE SET NULL,
  amount numeric(15,2) NOT NULL,
  expense_date date NOT NULL,
  reference_no text,
  description text,
  source_name text,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE expense_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members can view expense records"
  ON expense_records FOR SELECT TO authenticated USING (school_id = get_my_school_id());
CREATE POLICY "Super admin can insert expense records"
  ON expense_records FOR INSERT TO authenticated
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'accountant'));
CREATE POLICY "Super admin can update expense records"
  ON expense_records FOR UPDATE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'accountant'))
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'accountant'));
CREATE POLICY "Super admin can delete expense records"
  ON expense_records FOR DELETE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'accountant'));

-- Fees Groups
CREATE TABLE IF NOT EXISTS fees_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE fees_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members can view fees groups"
  ON fees_groups FOR SELECT TO authenticated USING (school_id = get_my_school_id());
CREATE POLICY "Super admin can insert fees groups"
  ON fees_groups FOR INSERT TO authenticated
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'accountant'));
CREATE POLICY "Super admin can update fees groups"
  ON fees_groups FOR UPDATE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'accountant'))
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'accountant'));
CREATE POLICY "Super admin can delete fees groups"
  ON fees_groups FOR DELETE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'accountant'));

-- Fees Types
CREATE TABLE IF NOT EXISTS fees_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  fees_group_id uuid REFERENCES fees_groups(id) ON DELETE SET NULL,
  name text NOT NULL,
  fees_code text,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE fees_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members can view fees types"
  ON fees_types FOR SELECT TO authenticated USING (school_id = get_my_school_id());
CREATE POLICY "Super admin can insert fees types"
  ON fees_types FOR INSERT TO authenticated
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'accountant'));
CREATE POLICY "Super admin can update fees types"
  ON fees_types FOR UPDATE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'accountant'))
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'accountant'));
CREATE POLICY "Super admin can delete fees types"
  ON fees_types FOR DELETE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'accountant'));

-- Fees Master
CREATE TABLE IF NOT EXISTS fees_master (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  fees_group_id uuid REFERENCES fees_groups(id) ON DELETE SET NULL,
  fees_type_id uuid REFERENCES fees_types(id) ON DELETE CASCADE,
  class_id uuid REFERENCES classes(id) ON DELETE SET NULL,
  academic_year_id uuid REFERENCES academic_years(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  due_date date,
  is_mandatory boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE fees_master ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members can view fees master"
  ON fees_master FOR SELECT TO authenticated USING (school_id = get_my_school_id());
CREATE POLICY "Super admin can insert fees master"
  ON fees_master FOR INSERT TO authenticated
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'accountant'));
CREATE POLICY "Super admin can update fees master"
  ON fees_master FOR UPDATE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'accountant'))
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'accountant'));
CREATE POLICY "Super admin can delete fees master"
  ON fees_master FOR DELETE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'accountant'));

-- Fees Discounts
CREATE TABLE IF NOT EXISTS fees_discounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  discount_code text,
  discount_type text DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value numeric(10,2) NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE fees_discounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members can view fees discounts"
  ON fees_discounts FOR SELECT TO authenticated USING (school_id = get_my_school_id());
CREATE POLICY "Super admin can insert fees discounts"
  ON fees_discounts FOR INSERT TO authenticated
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'accountant'));
CREATE POLICY "Super admin can update fees discounts"
  ON fees_discounts FOR UPDATE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'accountant'))
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'accountant'));
CREATE POLICY "Super admin can delete fees discounts"
  ON fees_discounts FOR DELETE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'accountant'));

-- Fees Collections
CREATE TABLE IF NOT EXISTS fees_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  student_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  fees_master_id uuid REFERENCES fees_master(id) ON DELETE SET NULL,
  discount_id uuid REFERENCES fees_discounts(id) ON DELETE SET NULL,
  amount numeric(12,2) NOT NULL,
  discount_amount numeric(12,2) DEFAULT 0,
  fine_amount numeric(12,2) DEFAULT 0,
  net_amount numeric(12,2) NOT NULL,
  payment_method text DEFAULT 'cash',
  receipt_no text,
  payment_date date NOT NULL,
  academic_year_id uuid REFERENCES academic_years(id) ON DELETE SET NULL,
  collected_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE fees_collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members can view fees collections"
  ON fees_collections FOR SELECT TO authenticated USING (school_id = get_my_school_id());
CREATE POLICY "Super admin and accountant can insert fees collections"
  ON fees_collections FOR INSERT TO authenticated
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'accountant'));
CREATE POLICY "Super admin and accountant can update fees collections"
  ON fees_collections FOR UPDATE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'accountant'))
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'accountant'));
CREATE POLICY "Super admin can delete fees collections"
  ON fees_collections FOR DELETE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'accountant'));

-- Fees Carry Forward
CREATE TABLE IF NOT EXISTS fees_carry_forward (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  student_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  from_year_id uuid REFERENCES academic_years(id) ON DELETE SET NULL,
  to_year_id uuid REFERENCES academic_years(id) ON DELETE SET NULL,
  balance_amount numeric(12,2) NOT NULL,
  reason text,
  carried_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE fees_carry_forward ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members can view fees carry forward"
  ON fees_carry_forward FOR SELECT TO authenticated USING (school_id = get_my_school_id());
CREATE POLICY "Super admin can insert fees carry forward"
  ON fees_carry_forward FOR INSERT TO authenticated
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'accountant'));
CREATE POLICY "Super admin can delete fees carry forward"
  ON fees_carry_forward FOR DELETE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'accountant'));

-- Books (Library)
CREATE TABLE IF NOT EXISTS books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  title text NOT NULL,
  author text,
  isbn text,
  category text,
  publisher text,
  edition text,
  quantity integer DEFAULT 1,
  available_quantity integer DEFAULT 1,
  shelf_location text,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members can view books"
  ON books FOR SELECT TO authenticated USING (school_id = get_my_school_id());
CREATE POLICY "Super admin can insert books"
  ON books FOR INSERT TO authenticated
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() = 'super_admin');
CREATE POLICY "Super admin can update books"
  ON books FOR UPDATE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin')
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() = 'super_admin');
CREATE POLICY "Super admin can delete books"
  ON books FOR DELETE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin');

-- Book Issues
CREATE TABLE IF NOT EXISTS book_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  book_id uuid REFERENCES books(id) ON DELETE CASCADE,
  member_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  member_type text DEFAULT 'student' CHECK (member_type IN ('student', 'teacher', 'staff')),
  issue_date date NOT NULL,
  due_date date NOT NULL,
  return_date date,
  fine_amount numeric(8,2) DEFAULT 0,
  status text DEFAULT 'issued' CHECK (status IN ('issued', 'returned', 'overdue', 'lost')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE book_issues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members can view book issues"
  ON book_issues FOR SELECT TO authenticated USING (school_id = get_my_school_id());
CREATE POLICY "Super admin can insert book issues"
  ON book_issues FOR INSERT TO authenticated
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() = 'super_admin');
CREATE POLICY "Super admin can update book issues"
  ON book_issues FOR UPDATE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin')
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() = 'super_admin');
CREATE POLICY "Super admin can delete book issues"
  ON book_issues FOR DELETE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin');

-- Transport Routes
CREATE TABLE IF NOT EXISTS transport_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  route_name text NOT NULL,
  description text,
  fare numeric(10,2) DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE transport_routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members can view transport routes"
  ON transport_routes FOR SELECT TO authenticated USING (school_id = get_my_school_id());
CREATE POLICY "Super admin can insert transport routes"
  ON transport_routes FOR INSERT TO authenticated
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() = 'super_admin');
CREATE POLICY "Super admin can update transport routes"
  ON transport_routes FOR UPDATE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin')
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() = 'super_admin');
CREATE POLICY "Super admin can delete transport routes"
  ON transport_routes FOR DELETE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin');

-- Transport Vehicles
CREATE TABLE IF NOT EXISTS transport_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  vehicle_no text NOT NULL,
  model text,
  capacity integer DEFAULT 0,
  driver_name text,
  driver_phone text,
  route_id uuid REFERENCES transport_routes(id) ON DELETE SET NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE transport_vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members can view vehicles"
  ON transport_vehicles FOR SELECT TO authenticated USING (school_id = get_my_school_id());
CREATE POLICY "Super admin can insert vehicles"
  ON transport_vehicles FOR INSERT TO authenticated
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() = 'super_admin');
CREATE POLICY "Super admin can update vehicles"
  ON transport_vehicles FOR UPDATE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin')
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() = 'super_admin');
CREATE POLICY "Super admin can delete vehicles"
  ON transport_vehicles FOR DELETE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin');

-- Transport Assignments
CREATE TABLE IF NOT EXISTS transport_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  student_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  route_id uuid REFERENCES transport_routes(id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES transport_vehicles(id) ON DELETE SET NULL,
  academic_year_id uuid REFERENCES academic_years(id) ON DELETE CASCADE,
  stop_name text,
  fare numeric(10,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(student_id, academic_year_id)
);
ALTER TABLE transport_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members can view transport assignments"
  ON transport_assignments FOR SELECT TO authenticated USING (school_id = get_my_school_id());
CREATE POLICY "Super admin can insert transport assignments"
  ON transport_assignments FOR INSERT TO authenticated
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() = 'super_admin');
CREATE POLICY "Super admin can update transport assignments"
  ON transport_assignments FOR UPDATE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin')
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() = 'super_admin');
CREATE POLICY "Super admin can delete transport assignments"
  ON transport_assignments FOR DELETE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin');

-- Dormitory Rooms
CREATE TABLE IF NOT EXISTS dormitory_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  room_no text NOT NULL,
  room_type text DEFAULT 'dormitory',
  capacity integer DEFAULT 1,
  cost_per_term numeric(12,2) DEFAULT 0,
  floor text,
  building text,
  is_active boolean DEFAULT true,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE dormitory_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members can view dormitory rooms"
  ON dormitory_rooms FOR SELECT TO authenticated USING (school_id = get_my_school_id());
CREATE POLICY "Super admin can insert dormitory rooms"
  ON dormitory_rooms FOR INSERT TO authenticated
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() = 'super_admin');
CREATE POLICY "Super admin can update dormitory rooms"
  ON dormitory_rooms FOR UPDATE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin')
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() = 'super_admin');
CREATE POLICY "Super admin can delete dormitory rooms"
  ON dormitory_rooms FOR DELETE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin');

-- Dormitory Assignments
CREATE TABLE IF NOT EXISTS dormitory_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  student_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  room_id uuid REFERENCES dormitory_rooms(id) ON DELETE CASCADE,
  academic_year_id uuid REFERENCES academic_years(id) ON DELETE CASCADE,
  check_in_date date,
  check_out_date date,
  status text DEFAULT 'active' CHECK (status IN ('active', 'vacated')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE dormitory_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members can view dormitory assignments"
  ON dormitory_assignments FOR SELECT TO authenticated USING (school_id = get_my_school_id());
CREATE POLICY "Super admin can insert dormitory assignments"
  ON dormitory_assignments FOR INSERT TO authenticated
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() = 'super_admin');
CREATE POLICY "Super admin can update dormitory assignments"
  ON dormitory_assignments FOR UPDATE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin')
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() = 'super_admin');
CREATE POLICY "Super admin can delete dormitory assignments"
  ON dormitory_assignments FOR DELETE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin');

-- Seed default payment methods
DO $$
DECLARE v_school_id uuid;
BEGIN
  SELECT id INTO v_school_id FROM schools LIMIT 1;
  IF v_school_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM payment_methods_list WHERE school_id = v_school_id) THEN
    INSERT INTO payment_methods_list (school_id, name) VALUES
      (v_school_id, 'Cash'), (v_school_id, 'Bank Transfer'), (v_school_id, 'POS/Card'),
      (v_school_id, 'Cheque'), (v_school_id, 'Online');
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_income_records_date ON income_records(income_date);
CREATE INDEX IF NOT EXISTS idx_expense_records_date ON expense_records(expense_date);
CREATE INDEX IF NOT EXISTS idx_fees_collections_student ON fees_collections(student_id);
CREATE INDEX IF NOT EXISTS idx_book_issues_member ON book_issues(member_id);
