CREATE TABLE auth_master (user_id serial primary key);

CREATE TABLE auth_facebook (external_id text, internal_id INTEGER REFERENCES auth_master (user_id));
