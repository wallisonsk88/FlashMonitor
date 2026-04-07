import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bkyawfljkkbkewvlkacw.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJreWF3Zmxqa2tia2V3dmxrYWN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1NTYxMzEsImV4cCI6MjA5MTEzMjEzMX0.35E1o9AwYPiQmIQIeNldn1krBi8CbvifYbmHoRW1hGc';

export const supabase = createClient(supabaseUrl, supabaseKey);
