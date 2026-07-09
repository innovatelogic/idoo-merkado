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
  constructor(user_id, sheet_id, role = 0) {
        this.user_id = user_id;
        this.sheet_id = sheet_id;
        this.role = role;
    }

    has_role(role) {
        return (this.role & role) === role;
    }

    sheet(name){
      if (this.sheet_id === null || this.sheet_id === '') { 
        return null;
      }
      const ss = SpreadsheetApp.openById(this.sheet_id);
      if (!ss){
        throw new Error(`[User::sheet] spreadsheet "${this.sheet_id}" not found`);
      }

      const sh = ss.getSheetByName(name);
      if (!sh) {
        throw new Error(`[User::sheet] sheet "${name}" in spreadsheet "${this.sheet_id}" not found `)
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
                         row[headers['role']]));
    } catch (e) {
      Logger.log(`Row failed: ${e.message}`);
    }
  });

  return users;
}

//----------------------------------------------------------------------------------------------
function deserialize_user(user_id, spreadsheet_id = "1QjpZXzhDAZqxbDVc3yAxWnH0Qa-DTrf2B7wg9fDyfDk")
{
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

  const row = data.find(r => r[headers['user_id']] === user_id);

  if (!row) {
    return null;
  }

  return new User(row[headers['user_id']],
                         row[headers['sheet_id']],
                         row[headers['role']]);
}

//----------------------------------------------------------------------------------------------
function get_current_user(user_id){
  return deserialize_user(Session.getActiveUser().getEmail());
}

//----------------------------------------------------------------------------------------------
var UserRole = User.Role;
if (typeof module !== "undefined" && module.exports) {
    module.exports = { User,
                       UserRole,
                       get_current_user };
}

//----------------------------------------------------------------------------------------------
function TEST_User_rights()
{
 const usr_SELLER = new User("1", "", User.Role.SELLER);
  const usr_MANAGER = new User("1", "", User.Role.MANAGER);
  const usr_ACCOUNTANT = new User("1", "", User.Role.ACCOUNTANT);
  const usr_OWNER = new User("1", "", User.Role.OWNER);
  const usr_ADMIN = new User("1", "", User.Role.ADMIN);

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


