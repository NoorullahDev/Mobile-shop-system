use rusqlite::Connection;

use crate::errors::AppError;
use crate::models::phone::{CreatePhoneOptionInput, PhoneOption};
use crate::repositories::phone_option_repository;

pub fn create(conn: &Connection, input: CreatePhoneOptionInput) -> Result<PhoneOption, AppError> {
    if input.option_type.trim().is_empty() {
        return Err(AppError::validation("Option type is required"));
    }
    if input.value.trim().is_empty() {
        return Err(AppError::validation("Value is required"));
    }

    let id = phone_option_repository::insert(conn, &input)?;
    phone_option_repository::get_by_id(conn, id)?
        .ok_or_else(|| AppError::validation("Failed to retrieve created phone option"))
}

pub fn list_by_type(conn: &Connection, option_type: &str) -> Result<Vec<PhoneOption>, AppError> {
    phone_option_repository::list_by_type(conn, option_type)
}

pub fn list_all(conn: &Connection) -> Result<Vec<PhoneOption>, AppError> {
    phone_option_repository::list_all(conn)
}

pub fn update(conn: &Connection, id: i64, input: CreatePhoneOptionInput) -> Result<PhoneOption, AppError> {
    if input.option_type.trim().is_empty() {
        return Err(AppError::validation("Option type is required"));
    }
    if input.value.trim().is_empty() {
        return Err(AppError::validation("Value is required"));
    }

    if !phone_option_repository::update(conn, id, &input)? {
        return Err(AppError::validation("Phone option not found"));
    }
    
    phone_option_repository::get_by_id(conn, id)?
        .ok_or_else(|| AppError::validation("Failed to retrieve updated phone option"))
}

pub fn delete(conn: &Connection, id: i64) -> Result<(), AppError> {
    if !phone_option_repository::delete(conn, id)? {
        return Err(AppError::validation("Phone option not found"));
    }
    Ok(())
}

pub fn set_active(conn: &Connection, id: i64, is_active: bool) -> Result<(), AppError> {
    if !phone_option_repository::set_active(conn, id, is_active)? {
        return Err(AppError::validation("Phone option not found"));
    }
    Ok(())
}
