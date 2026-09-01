/*
  # Seed OGS Timetable Time Slots

  Replaces all existing time slots with the official OGS school daily schedule:

  1. Devotion/Assembly    07:45 – 08:05  (break)
  2. Period 1             08:05 – 08:50  (class)
  3. Period 2             08:50 – 09:30  (class)
  4. Period 3             09:30 – 10:10  (class)
  5. Period 4             10:10 – 10:50  (class)
  6. Period 5             10:50 – 11:30  (class)
  7. Break                11:30 – 12:00  (break)
  8. Period 6             12:00 – 12:40  (class)
  9. Period 7             12:40 – 13:20  (class)
  10. Period 8            13:20 – 14:00  (class)
  11. Lesson Break        14:00 – 14:20  (break)
  12. Period 9            14:20 – 15:00  (class)
  13. Period 10           15:00 – 15:40  (class)
  14. Closing Assembly    15:40 – 16:00  (break)

  Applies to every school in the schools table.
*/

DO $$
DECLARE
  v_school_id uuid;
BEGIN
  FOR v_school_id IN SELECT id FROM schools LOOP

    DELETE FROM time_slots WHERE school_id = v_school_id;

    INSERT INTO time_slots (school_id, period_name, time_type, start_time, end_time, sort_order) VALUES
      (v_school_id, 'Devotion / Assembly', 'break', '07:45', '08:05', 1),
      (v_school_id, 'Period 1',            'class', '08:05', '08:50', 2),
      (v_school_id, 'Period 2',            'class', '08:50', '09:30', 3),
      (v_school_id, 'Period 3',            'class', '09:30', '10:10', 4),
      (v_school_id, 'Period 4',            'class', '10:10', '10:50', 5),
      (v_school_id, 'Period 5',            'class', '10:50', '11:30', 6),
      (v_school_id, 'Break',               'break', '11:30', '12:00', 7),
      (v_school_id, 'Period 6',            'class', '12:00', '12:40', 8),
      (v_school_id, 'Period 7',            'class', '12:40', '13:20', 9),
      (v_school_id, 'Period 8',            'class', '13:20', '14:00', 10),
      (v_school_id, 'Lesson Break',        'break', '14:00', '14:20', 11),
      (v_school_id, 'Period 9',            'class', '14:20', '15:00', 12),
      (v_school_id, 'Period 10',           'class', '15:00', '15:40', 13),
      (v_school_id, 'Closing Assembly',    'break', '15:40', '16:00', 14);

  END LOOP;
END $$;
