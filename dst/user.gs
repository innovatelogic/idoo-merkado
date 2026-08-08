/**
 * @fileoverview Role-Based Access Control (RBAC) and User Session Identity Module.
 *               Sync identityrecords from a Google Sheets centralized registry database.
 * @package      idoo.merkado
 * @author       yurg
 * @copyright    Copyright (c) 2026 idoo.work
 * @license      All Rights Reserved
 * * -----------------------------------------------------------------------------
 * File:         user.js
 * Created:      Monday, July 6, 2026
 * -----------------------------------------------------------------------------
 */

class User {
  constructor(user_id, sheet_id, ctx, role = 0) {
        this.user_id = user_id;
        this.sheet_id = sheet_id;
        this.ctx = ctx;
        this.role = role;
    }

    has_role(role) {
        return (this.role & role) === role;
    }

    spreadsheet(){
      if (this.sheet_id === null || this.sheet_id === '') { 
        return null;
      }
      const ss = SpreadsheetApp.openById(this.sheet_id);
      if (!ss){
        throw new Error(`[User::sheet] spreadsheet "${this.sheet_id}" not found`);
      }
      return ss;
    }

    sheet(name){
      /*if (this.sheet_id === null || this.sheet_id === '') { 
        return null;
      }
      const ss = SpreadsheetApp.openById(this.sheet_id);
      if (!ss){
        throw new Error(`[User::sheet] spreadsheet "${this.sheet_id}" not found`);
      }*/

      const ss = this.spreadsheet();

      const sh = ss.getSheetByName(name);
      if (!sh) {
        throw new Error(`[User::sheet] sheet "${name}" in spreadsheet "${this.sheet_id}" not found `);
      }
      return sh;
    }
};

User.Role = {
    SELLER:     1 << 0,   // 0001 1
    MANAGER:    1 << 1,   // 0010 2
    ACCOUNTANT: 1 << 2,   // 0100 4
    OWNER:      1 << 3,   // 1000 8
};

User.Role.ADMIN = User.Role.MANAGER | 
                    User.Role.SELLER |
                    User.Role.ACCOUNTANT |
                    User.Role.OWNER;

//----------------------------------------------------------------------------------------------
function deserialize_users(spreadsheet_id = "1QjpZXzhDAZqxbDVc3yAxWnH0Qa-DTrf2B7wg9fDyfDk") {

  var ss = SpreadsheetApp.openById(spreadsheet_id);
  var table_name = "users";
  const sh = ss.getSheetByName(table_name);

  if (!sh) { 
    throw new Error(`Sheet "${table_name}" not found!`);
  }
  
  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2) return [];

  const headers = get_table_header_map_sheet(sh);
  const data = sh.getRange(2, 1, lastRow - 1, lastCol)
                  .getValues()
                  .filter(row => row.some(cell => cell !== '' && cell !== null));

  const users = new Map();

  data.forEach(row => {
    try {
      users.set(row[headers['user_id']], 
                new User(row[headers['user_id']],
                         row[headers['sheet_id']],
                         row[headers['user_ctx']],
                         row[headers['role']]));
    } catch (e) {
      Logger.log(`Row failed: ${e.message}`);
    }
  });

  return users;
}

//----------------------------------------------------------------------------------------------
function deserialize_user(curr_user_id, curr_spreadsheet_id, users_spreadsheet_id = "1QjpZXzhDAZqxbDVc3yAxWnH0Qa-DTrf2B7wg9fDyfDk")
{
  var sh = SpreadsheetApp.openById(users_spreadsheet_id);
  var table_name = "users";
  const ss = sh.getSheetByName(table_name);

  if (!ss) { 
    throw new Error(`[deserialize_user] Sheet "${table_name}" not found!`);
  }

  const desc = get_user_desc(ss, curr_user_id);

  if (!desc){
    throw new Error(`[deserialize_user] User not found!`);
  }

  const current = desc[curr_spreadsheet_id];

  if (!current){
    throw new Error(`[deserialize_user] Spreadsheet "${curr_spreadsheet_id}" not found!`);
  }
  
  return new User(curr_user_id, curr_spreadsheet_id, current, current.role);
}

//----------------------------------------------------------------------------------------------
function get_current_user(){
  const curr_user_id = Session.getActiveUser().getEmail();
  const curr_spreadsheet_id = SpreadsheetApp.getActiveSpreadsheet().getId();
  const users_spreadsheet_id = "1QjpZXzhDAZqxbDVc3yAxWnH0Qa-DTrf2B7wg9fDyfDk";

  return deserialize_user(curr_user_id, curr_spreadsheet_id, users_spreadsheet_id);
}

//----------------------------------------------------------------------------------------------
function TEST_deserialize_user()
{
  const curr_user_id = "dev.user@idoo.work";
  const curr_spreadsheet_id = "1ygEPOsFbzveVtx90pWYMkiOlZJdbOc7HJiLaGN3vKZM";
  const users_spreadsheet_id = "1QjpZXzhDAZqxbDVc3yAxWnH0Qa-DTrf2B7wg9fDyfDk";

  const user = deserialize_user(curr_user_id, curr_spreadsheet_id, users_spreadsheet_id);

  console.log(user);
}

//----------------------------------------------------------------------------------------------
function get_user_desc(ss, user_id) {

  if (!ss || !user_id) { 
    throw new Error(`[get_user_desc] invalid input param`);
  }

  const lastRow = ss.getLastRow();
  const lastCol = ss.getLastColumn();
  if (lastRow < 2) return [];

  const headers = get_table_header_map_sheet(ss);
  const data = ss.getRange(2, 1, lastRow - 1, lastCol)
                  .getValues()
                  .filter(row => row.some(cell => cell !== '' && cell !== null));

  const row = data.find(r => r[headers['user_id']] === user_id);

  if (!row) { throw new Error(`[get_user_desc] User not found!`); }

  return JSON.parse(row[headers['user_ctx']]);
}

//----------------------------------------------------------------------------------------------
var UserRole = User.Role;
if (typeof module !== "undefined" && module.exports) {
    module.exports = { User,
                       UserRole,
                       get_current_user,
                       request_root_spreadsheet };
}


//----------------------------------------------------------------------------------------------
function TEST_User_rights()
{
  const usr_SELLER = new User("1", "", null, User.Role.SELLER);
  const usr_MANAGER = new User("1", "", null, User.Role.MANAGER);
  const usr_ACCOUNTANT = new User("1", "", null, User.Role.ACCOUNTANT);
  const usr_OWNER = new User("1", "", null, User.Role.OWNER);
  const usr_ADMIN = new User("1", "", null, User.Role.ADMIN);

  // SELLER
  if (!usr_SELLER.has_role(User.Role.SELLER)) throw new Error("Test failed");
  if (usr_SELLER.has_role(User.Role.MANAGER | User.Role.ACCOUNTANT | User.Role.OWNER)) throw new Error("Test failed");
  if (usr_SELLER.has_role(User.Role.ADMIN)) throw new Error("Test failed");

  // MANAGER
  if (!usr_MANAGER.has_role(User.Role.MANAGER)) throw new Error("Test failed");
  if (usr_MANAGER.has_role(User.Role.SELLER)) throw new Error("Test failed");
  if (usr_MANAGER.has_role(User.Role.OWNER | User.Role.ACCOUNTANT)) throw new Error("Test failed");

  // OWNER
  if (!usr_OWNER.has_role(User.Role.OWNER)) throw new Error("Test failed");
  if (usr_OWNER.has_role(User.Role.SELLER)) throw new Error("Test failed");

  // ADMIN
  if (!usr_ADMIN.has_role(User.Role.SELLER)) throw new Error("Test failed");
  if (!usr_ADMIN.has_role(User.Role.MANAGER)) throw new Error("Test failed");
  if (!usr_ADMIN.has_role(User.Role.ACCOUNTANT)) throw new Error("Test failed");
  if (!usr_ADMIN.has_role(User.Role.OWNER)) throw new Error("Test failed");

  if (!usr_ADMIN.has_role(User.Role.SELLER | User.Role.MANAGER)) throw new Error("Test failed");
  if (!usr_ADMIN.has_role(User.Role.MANAGER | User.Role.ACCOUNTANT)) throw new Error("Test failed");
  if (!usr_ADMIN.has_role(User.Role.SELLER | User.Role.MANAGER | User.Role.ACCOUNTANT)) throw new Error("Test failed");
}

//----------------------------------------------------------------------------------------------
function TEST_Request_Form()
{
  const usr = new User("1", "", JSON.stringify([
      {
        "name": "🟢 DEV: Bike",
        "id": "1un_JsVWL7UC5J-2UvoxkOFhcDj__CdCUoTzTW2zxqrk"
      },
      {
        "name": "🟢 DEV: Xbat",
        "id": "1TD1uQTRf3gCqHRXxAt5Q2jTzsTjZ-o0hlRY-vjT41pE"
      }
    ]), User.Role.SELLER);

    //usr.request_root_spreadsheet();
}


